using Npgsql;

namespace Household.Api.Platform;

public static class HouseholdConfiguration
{
    public static string ConnectionString(IConfiguration configuration)
    {
        string? configured = configuration.GetConnectionString("Household");
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

    public static bool Boolean(string key, bool fallback = false) =>
        bool.TryParse(Environment.GetEnvironmentVariable(key), out bool result) ? result : fallback;

    public static string String(string key, string fallback = "") =>
        Environment.GetEnvironmentVariable(key) is { Length: > 0 } value ? value : fallback;

    private static int Integer(string key, int fallback) =>
        int.TryParse(Environment.GetEnvironmentVariable(key), out int result) ? result : fallback;
}
