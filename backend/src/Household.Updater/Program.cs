using System.Diagnostics;
using System.Text.Json;

namespace Household.Updater;

public partial class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.WebHost.UseUrls(Environment.GetEnvironmentVariable("HOUSEHOLD_UPDATER_LISTEN_ADDR") is { Length: > 0 } address
            ? NormalizeAddress(address)
            : "http://0.0.0.0:8091");
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddSingleton<UpdateCoordinator>();
        var app = builder.Build();
        app.MapGet("/healthz", () => Results.NoContent());
        app.MapGet("/status", (HttpContext context, UpdateCoordinator coordinator) =>
            Authorized(context) is { } error ? error : Results.Ok(coordinator.Status));
        app.MapPost("/update", (UpdateRequest request, HttpContext context, UpdateCoordinator coordinator) =>
        {
            if (Authorized(context) is { } error) return error;
            if (string.IsNullOrWhiteSpace(request.Version)) return Results.Json(new { error = "version is required" }, statusCode: 422);
            return coordinator.TryStart(request)
                ? Results.Json(coordinator.Status, statusCode: 202)
                : Results.Json(new { error = "update already running" }, statusCode: 409);
        });
        app.Run();
    }

    private static IResult? Authorized(HttpContext context)
    {
        var expected = Environment.GetEnvironmentVariable("HOUSEHOLD_UPDATER_TOKEN") ?? "";
        if (expected.Length == 0) return Results.Json(new { error = "updater token is not configured" }, statusCode: 503);
        return context.Request.Headers.Authorization == $"Bearer {expected}"
            ? null
            : Results.Json(new { error = "unauthorized" }, statusCode: 401);
    }

    private static string NormalizeAddress(string address) => address.StartsWith(':')
        ? $"http://0.0.0.0{address}"
        : address.Contains("://", StringComparison.Ordinal) ? address : $"http://{address}";
}

public sealed record UpdateRequest(string Version, string? Channel);
public sealed record UpdateStatus(string State, string? Version = null, string? Channel = null, string? Message = null, DateTime? StartedAt = null, DateTime? EndedAt = null);

public sealed class UpdateCoordinator(ILogger<UpdateCoordinator> logger, TimeProvider timeProvider)
{
    private readonly object gate = new();
    private UpdateStatus status = new("idle");
    public UpdateStatus Status { get { lock (gate) return status; } }

    public bool TryStart(UpdateRequest request)
    {
        lock (gate)
        {
            if (status.State == "running") return false;
            status = new UpdateStatus("running", request.Version.Trim(), request.Channel, "starting", timeProvider.GetUtcNow().UtcDateTime);
        }
        _ = Task.Run(() => RunAsync(request));
        return true;
    }

    private async Task RunAsync(UpdateRequest request)
    {
        try
        {
            var stack = Get("HOUSEHOLD_UPDATER_STACK_DIR", "/stack");
            var environment = Get("HOUSEHOLD_UPDATER_ENV_FILE", "/stack/.env");
            var compose = Get("HOUSEHOLD_UPDATER_COMPOSE_FILE", "/stack/docker-compose.yml");
            var backups = Get("HOUSEHOLD_UPDATER_BACKUP_DIR", "/stack/backups");
            SetMessage("updating environment");
            await UpdateVersion(environment, request.Version.Trim());
            Directory.CreateDirectory(backups);
            SetMessage("creating backup");
            var backup = Path.Combine(backups, $"household-before-{Clean(request.Version)}-{timeProvider.GetUtcNow():yyyyMMddHHmmss}.dump");
            await Run(stack, backup, "docker", "compose", "--env-file", environment, "-f", compose,
                "exec", "-T", "household-db", "sh", "-c", "pg_dump -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Fc");
            SetMessage("pulling images");
            await Run(stack, null, "docker", "compose", "--env-file", environment, "-f", compose, "pull", "household-api", "household-web");
            SetMessage("restarting stack");
            await Run(stack, null, "docker", "compose", "--env-file", environment, "-f", compose, "up", "-d", "household-api", "household-web");
            lock (gate) status = status with { State = "succeeded", Message = "update applied", EndedAt = timeProvider.GetUtcNow().UtcDateTime };
        }
        catch (Exception error)
        {
            logger.LogError(error, "Household update failed");
            lock (gate) status = status with { State = "failed", Message = error.Message, EndedAt = timeProvider.GetUtcNow().UtcDateTime };
        }
    }

    private void SetMessage(string message) { lock (gate) status = status with { Message = message }; }

    private static async Task UpdateVersion(string path, string version)
    {
        var lines = (await File.ReadAllLinesAsync(path)).ToList();
        var index = lines.FindIndex(x => x.StartsWith("HOUSEHOLD_VERSION=", StringComparison.Ordinal));
        if (index >= 0) lines[index] = $"HOUSEHOLD_VERSION={version}"; else lines.Add($"HOUSEHOLD_VERSION={version}");
        await File.WriteAllLinesAsync(path, lines);
    }

    private static async Task Run(string workingDirectory, string? outputPath, string executable, params string[] arguments)
    {
        var info = new ProcessStartInfo(executable) { WorkingDirectory = workingDirectory, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
        foreach (var argument in arguments) info.ArgumentList.Add(argument);
        using var process = Process.Start(info) ?? throw new InvalidOperationException($"Could not start {executable}.");
        await using var output = outputPath is null ? null : File.Create(outputPath);
        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(10));
        Task outputTask = output is null
            ? process.StandardOutput.ReadToEndAsync(timeout.Token)
            : process.StandardOutput.BaseStream.CopyToAsync(output, timeout.Token);
        var errorTask = process.StandardError.ReadToEndAsync(timeout.Token);
        try
        {
            await Task.WhenAll(outputTask, errorTask, process.WaitForExitAsync(timeout.Token));
        }
        catch (OperationCanceledException) when (timeout.IsCancellationRequested)
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            throw new TimeoutException($"{executable} exceeded the 10 minute update step limit.");
        }
        if (process.ExitCode != 0) throw new InvalidOperationException($"{executable} failed: {await errorTask}");
    }

    private static string Get(string key, string fallback) => Environment.GetEnvironmentVariable(key) is { Length: > 0 } value ? value : fallback;
    private static string Clean(string version) => version.Replace('/', '-').Replace(':', '-').Replace('@', '-');
}
