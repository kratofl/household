using System.Text.Json.Serialization;

namespace Household.Api.Features.Updates;

public sealed record GitHubRelease(
    [property: JsonPropertyName("tag_name")] string TagName,
    string Name,
    bool Draft,
    bool Prerelease,
    [property: JsonPropertyName("published_at")] DateTime PublishedAt,
    [property: JsonPropertyName("html_url")] string HtmlUrl,
    string Body,
    IReadOnlyList<GitHubAsset> Assets);

public sealed record GitHubAsset(
    string Name,
    [property: JsonPropertyName("browser_download_url")] string BrowserDownloadUrl);

public sealed record UpdateCandidate(
    string Version,
    string Channel,
    string Name,
    bool Prerelease,
    DateTime PublishedAt,
    string HtmlUrl,
    string ReleaseNotes,
    string? ManifestUrl);
