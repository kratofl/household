using System.Net.Http.Headers;
using System.Net.Http.Json;
using Household.Api.Platform;

namespace Household.Api.Features.Updates;

public sealed class UpdatesClient(HttpClient httpClient)
{
    public async Task<IReadOnlyList<GitHubRelease>> ReleasesAsync(CancellationToken cancellationToken)
    {
        var repository = HouseholdConfiguration.String("HOUSEHOLD_UPDATES_GITHUB_REPOSITORY", "kratofl/household").Trim('/');
        using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.github.com/repos/{repository}/releases?per_page=20");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        request.Headers.UserAgent.ParseAdd("household-api");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<List<GitHubRelease>>(cancellationToken) ?? [];
    }

    public async Task<HttpResponseMessage> UpdaterAsync(HttpMethod method, string path, object? body, CancellationToken cancellationToken)
    {
        var baseUrl = HouseholdConfiguration.String("HOUSEHOLD_UPDATES_UPDATER_URL").TrimEnd('/');
        if (baseUrl.Length == 0) throw new InvalidOperationException("Updater is disabled.");
        var request = new HttpRequestMessage(method, baseUrl + path);
        var token = HouseholdConfiguration.String("HOUSEHOLD_UPDATES_UPDATER_TOKEN");
        if (token.Length > 0) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) request.Content = JsonContent.Create(body);
        return await httpClient.SendAsync(request, cancellationToken);
    }
}
