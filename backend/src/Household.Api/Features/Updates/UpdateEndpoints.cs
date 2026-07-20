using Household.Api.Features.Audit;
using Household.Api.Features.Identity;
using Household.Api.Platform;

namespace Household.Api.Features.Updates;

public static class UpdateEndpoints
{
    public static IEndpointRouteBuilder MapUpdateEndpoints(this IEndpointRouteBuilder routes)
    {
        var updates = routes.MapGroup("/updates");
        updates.MapGet("/candidates", Candidates);
        updates.MapGet("/status", Status);
        updates.MapPost("/jobs", StartJob);
        return routes;
    }

    private static async Task<IResult> Candidates(
        HttpContext context,
        IIdentityAccess identity,
        UpdatesClient client,
        AuditWriter audit,
        CancellationToken cancellationToken)
    {
        var admin = await Admin(context, identity, cancellationToken);
        if (admin.Error is not null) return admin.Error;
        try
        {
            var releases = await client.ReleasesAsync(cancellationToken);
            var stable = releases.FirstOrDefault(x => !x.Draft && !x.Prerelease);
            var unstable = releases.FirstOrDefault(x => !x.Draft && x.Prerelease);
            await audit.RecordAsync(context, admin.User, "release_check", "updates", "release", "success", null, cancellationToken);
            return Results.Ok(new { stable = ToCandidate(stable, "stable"), unstable = ToCandidate(unstable, "unstable") });
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            await audit.RecordAsync(context, admin.User, "release_check", "updates", "release", "failure", null, cancellationToken, error.Message);
            return HttpResults.Problem(502, "Release check failed", error.Message);
        }
    }

    private static async Task<IResult> Status(
        HttpContext context,
        IIdentityAccess identity,
        UpdatesClient client,
        CancellationToken cancellationToken)
    {
        var admin = await Admin(context, identity, cancellationToken);
        if (admin.Error is not null) return admin.Error;
        if (HouseholdConfiguration.String("HOUSEHOLD_UPDATES_UPDATER_URL").Length == 0)
            return Results.Ok(new { state = "disabled" });
        try
        {
            using var response = await client.UpdaterAsync(HttpMethod.Get, "/status", null, cancellationToken);
            return Results.Content(await response.Content.ReadAsStringAsync(cancellationToken), "application/json", statusCode: (int)response.StatusCode);
        }
        catch (HttpRequestException error)
        {
            return HttpResults.Problem(502, "Updater unavailable", error.Message);
        }
    }

    private static async Task<IResult> StartJob(
        StartJobRequest request,
        HttpContext context,
        IIdentityAccess identity,
        UpdatesClient client,
        AuditWriter audit,
        CancellationToken cancellationToken)
    {
        var admin = await Admin(context, identity, cancellationToken);
        if (admin.Error is not null) return admin.Error;
        if (HouseholdConfiguration.String("HOUSEHOLD_UPDATES_UPDATER_URL").Length == 0)
            return HttpResults.Problem(503, "Updater disabled", "HOUSEHOLD_UPDATES_UPDATER_URL is not configured");
        if (string.IsNullOrWhiteSpace(request.Version))
            return HttpResults.Problem(422, "Validation failed", "Version is required");
        try
        {
            using var response = await client.UpdaterAsync(HttpMethod.Post, "/update", request, cancellationToken);
            var outcome = response.IsSuccessStatusCode ? "success" : "failure";
            await audit.RecordAsync(context, admin.User, "update_start", "updates", "release", outcome,
                new { request.Version, request.Channel }, cancellationToken,
                response.IsSuccessStatusCode ? "" : $"updater HTTP {(int)response.StatusCode}");
            return Results.Content(await response.Content.ReadAsStringAsync(cancellationToken), "application/json", statusCode: (int)response.StatusCode);
        }
        catch (HttpRequestException error)
        {
            await audit.RecordAsync(context, admin.User, "update_start", "updates", "release", "failure",
                new { request.Version, request.Channel }, cancellationToken, error.Message);
            return HttpResults.Problem(502, "Updater unavailable", error.Message);
        }
    }

    private static UpdateCandidate? ToCandidate(GitHubRelease? release, string channel)
    {
        if (release is null) return null;
        return new UpdateCandidate(release.TagName, channel, release.Name, release.Prerelease,
            release.PublishedAt, release.HtmlUrl, release.Body,
            release.Assets.FirstOrDefault(x => x.Name == "household-release.json")?.BrowserDownloadUrl);
    }

    private static async Task<(CurrentUser? User, IResult? Error)> Admin(
        HttpContext context, IIdentityAccess identity, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return (null, HttpResults.Problem(401, "Unauthorized", "Invalid bearer token"));
        if (user.Role != Roles.Admin) return (null, HttpResults.Problem(403, "Forbidden", "Admin role required"));
        return (user, null);
    }

    private sealed record StartJobRequest(string? Version, string? Channel);
}
