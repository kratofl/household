using System.Diagnostics;
using System.Net.Http.Json;
using Household.Api.Features.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;

namespace Household.Api.Tests;

/// <summary>
/// One fresh PostgreSQL and two API hosts on it: one with OIDC configured against
/// <see cref="FakeIdentityProvider"/>, one with OIDC switched off. Seeds password users to link.
/// </summary>
public sealed class OidcFixture : IAsyncLifetime
{
    public const string Issuer = "https://auth.test";
    public const string ClientId = "household";
    public const string ClientSecret = "provider-client-secret";
    public const string RedirectUri = "https://household.test/auth/callback";
    public static readonly DateTimeOffset Now = new DateTimeOffset(2026, 7, 23, 12, 0, 0, TimeSpan.Zero);

    private readonly string _containerName = $"household-oidc-tests-{Guid.NewGuid():N}";
    private string _connectionString = "";
    private WebApplicationFactory<Program>? _enabled;
    private WebApplicationFactory<Program>? _disabled;

    public FakeIdentityProvider Provider { get; } = new FakeIdentityProvider(Issuer, ClientId, ClientSecret, Now);

    public HttpClient Client => (this._enabled ?? throw new InvalidOperationException("Fixture has not started.")).CreateClient();

    public HttpClient DisabledClient => (this._disabled ?? throw new InvalidOperationException("Fixture has not started.")).CreateClient();

    public async Task InitializeAsync()
    {
        await this.StartDatabase();
        this._enabled = this.Host(new OidcSettings(true, Issuer, ClientId, ClientSecret, "Pocket ID"));
        _ = this.Client;
        this._disabled = this.Host(OidcSettings.Disabled);
        _ = this.DisabledClient;
    }

    public async Task DisposeAsync()
    {
        if (this._enabled is not null) await this._enabled.DisposeAsync();
        if (this._disabled is not null) await this._disabled.DisposeAsync();
        await RunDocker("rm", "-f", this._containerName);
    }

    /// <summary>Creates a user that signs in with a password, as registration plus admin approval would.</summary>
    public async Task CreatePasswordUser(string name, string password, string role = "user")
    {
        await using NpgsqlConnection connection = new NpgsqlConnection(this._connectionString);
        await connection.OpenAsync();
        await using NpgsqlCommand command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO identity.users (name, email, password_hash, role, status)
            VALUES (@name, @email, @hash, @role, 'active')
            """;
        command.Parameters.AddWithValue("role", role);
        command.Parameters.AddWithValue("name", name);
        command.Parameters.AddWithValue("email", $"{name}@household.test");
        command.Parameters.AddWithValue("hash", BCrypt.Net.BCrypt.HashPassword(password, 4));
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>Approves a pending user, as an admin would.</summary>
    public async Task Activate(string name)
    {
        await using NpgsqlConnection connection = new NpgsqlConnection(this._connectionString);
        await connection.OpenAsync();
        await using NpgsqlCommand command = connection.CreateCommand();
        command.CommandText = "UPDATE identity.users SET status = 'active' WHERE name = @name";
        command.Parameters.AddWithValue("name", name);
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>Signs in with username and password and returns the access token.</summary>
    public async Task<string> PasswordLogin(string name, string password)
    {
        using HttpClient client = this.Client;
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/v1/auth/authorize", new { username = name, password });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TokenPair>())!.AccessToken;
    }

    private WebApplicationFactory<Program> Host(OidcSettings settings) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Household", this._connectionString);
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:Household"] = this._connectionString }));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(new FixedTimeProvider(Now));
                services.RemoveAll<OidcSettings>();
                services.AddSingleton(settings);
                services.AddHttpClient<OidcProvider>().ConfigurePrimaryHttpMessageHandler(() => this.Provider);
            });
        });

    private async Task StartDatabase()
    {
        await RunDocker("run", "--detach", "--rm", "--name", this._containerName,
            "--env", "POSTGRES_DB=household", "--env", "POSTGRES_USER=household",
            "--env", "POSTGRES_PASSWORD=household", "--publish", "127.0.0.1::5432",
            "postgres:18.4-alpine3.23");
        string portOutput = await RunDocker("port", this._containerName, "5432/tcp");
        int port = int.Parse(portOutput.Trim().Split(':')[^1]);
        this._connectionString = $"Host=127.0.0.1;Port={port};Database=household;Username=household;Password=household";
        DateTime deadline = DateTime.UtcNow.AddSeconds(60);
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                await using NpgsqlConnection connection = new NpgsqlConnection(this._connectionString);
                await connection.OpenAsync();
                return;
            }
            catch (NpgsqlException)
            {
                await Task.Delay(250);
            }
        }
        throw new TimeoutException("PostgreSQL test container did not become ready.");
    }

    private static async Task<string> RunDocker(params string[] arguments)
    {
        ProcessStartInfo startInfo = new ProcessStartInfo("docker")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (string argument in arguments) startInfo.ArgumentList.Add(argument);
        using Process process = Process.Start(startInfo) ?? throw new InvalidOperationException("Could not start Docker CLI.");
        string output = await process.StandardOutput.ReadToEndAsync();
        string error = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        if (process.ExitCode != 0) throw new InvalidOperationException($"docker {string.Join(' ', arguments)} failed: {error}");
        return output;
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
