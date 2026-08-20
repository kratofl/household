using System.Text.RegularExpressions;

namespace Household.Api.Features.Budget;

public sealed record MerchantInfo(string Raw, string Normalized, string? BrandKey, string DisplayName);

public static partial class MerchantPresentation
{
    private static readonly IReadOnlyDictionary<string, (string BrandKey, string DisplayName)> KnownBrands =
        new Dictionary<string, (string, string)>(StringComparer.OrdinalIgnoreCase)
        {
            ["REWE"] = ("rewe", "REWE"),
            ["EDEKA"] = ("edeka", "EDEKA"),
            ["HBO"] = ("hbo", "HBO"),
            ["DISNEY"] = ("disney-plus", "Disney+"),
            ["DISNEY PLUS"] = ("disney-plus", "Disney+"),
        };

    public static MerchantInfo From(string? value)
    {
        var raw = value?.Trim() ?? "";
        var normalized = Whitespace().Replace(NonWord().Replace(raw.ToUpperInvariant(), " "), " ").Trim();
        return KnownBrands.TryGetValue(normalized, out var brand)
            ? new MerchantInfo(raw, brand.BrandKey == "disney-plus" ? "DISNEY PLUS" : normalized, brand.BrandKey, brand.DisplayName)
            : new MerchantInfo(raw, normalized, null, raw.Length == 0 ? "" : raw);
    }

    public static IReadOnlyList<MerchantInfo> Known(string query) => KnownBrands
        .Where(x => x.Key.Contains(query, StringComparison.OrdinalIgnoreCase) || x.Value.DisplayName.Contains(query, StringComparison.OrdinalIgnoreCase))
        .Select(x => new MerchantInfo(x.Value.DisplayName, x.Key, x.Value.BrandKey, x.Value.DisplayName))
        .DistinctBy(x => x.BrandKey)
        .ToList();

    [GeneratedRegex("[^A-Z0-9]+")]
    private static partial Regex NonWord();

    [GeneratedRegex("\\s+")]
    private static partial Regex Whitespace();
}
