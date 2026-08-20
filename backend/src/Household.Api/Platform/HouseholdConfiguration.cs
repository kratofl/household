using Npgsql;

namespace Household.Api.Platform;

public static class HouseholdConfiguration
{
    public static string ConnectionString(IConfiguration configuration)
    {
        var configured = configuration.GetConnectionString("Household");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured;
        }

        return new NpgsqlConnectionStringBuilder
        {
            Host = Environment.GetEnvironmentVariable("HOUSEHOLD_API_DB_HOST") ?? "localhost",
            Port = Integer("HOUSEHOLD_API_DB_PORT", 5432),
            Database = Environment.GetEnvironmentVariable("HOUSEHOLD_API_DB_DATABASE") ?? "household",
            Username = Environment.GetEnvironmentVariable("HOUSEHOLD_API_DB_USER") ?? "household",
            Password = Environment.GetEnvironmentVariable("HOUSEHOLD_API_DB_PASSWORD") ?? "household",
        }.ConnectionString;
    }

    public static TimeSpan UpdatesTimeout()
    {
        var value = Environment.GetEnvironmentVariable("HOUSEHOLD_UPDATES_TIMEOUT");
        return TryParseGoDuration(value, out var result) ? result : TimeSpan.FromSeconds(15);
    }

    public static bool Boolean(string key, bool fallback = false) =>
        bool.TryParse(Environment.GetEnvironmentVariable(key), out var result) ? result : fallback;

    public static string String(string key, string fallback = "") =>
        Environment.GetEnvironmentVariable(key) is { Length: > 0 } value ? value : fallback;

    private static int Integer(string key, int fallback) =>
        int.TryParse(Environment.GetEnvironmentVariable(key), out var result) ? result : fallback;

    private static bool TryParseGoDuration(string? value, out TimeSpan result)
    {
        result = default;
        if (string.IsNullOrWhiteSpace(value)) return false;
        if (value.EndsWith("ms", StringComparison.OrdinalIgnoreCase) &&
            double.TryParse(value[..^2], out var milliseconds))
        {
            result = TimeSpan.FromMilliseconds(milliseconds);
            return true;
        }

        if (!double.TryParse(value[..^1], out var amount)) return false;
        result = char.ToLowerInvariant(value[^1]) switch
        {
            's' => TimeSpan.FromSeconds(amount),
            'm' => TimeSpan.FromMinutes(amount),
            'h' => TimeSpan.FromHours(amount),
            _ => default,
        };
        return result != default;
    }
}
