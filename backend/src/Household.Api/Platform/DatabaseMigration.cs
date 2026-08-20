using Household.Api.Features.Audit;
using Household.Api.Features.Budget;
using Household.Api.Features.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Household.Api.Platform;

public static class DatabaseMigration
{
    public static async Task ApplyAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        var identity = services.GetRequiredService<IdentityDbContext>();
        await EnsureSchemasAsync(identity.Database.GetConnectionString()!, cancellationToken);
        await identity.Database.MigrateAsync(cancellationToken);
        await services.GetRequiredService<AuditDbContext>().Database.MigrateAsync(cancellationToken);
        await services.GetRequiredService<BudgetDbContext>().Database.MigrateAsync(cancellationToken);
    }

    private static async Task EnsureSchemasAsync(string connectionString, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "CREATE SCHEMA IF NOT EXISTS identity; CREATE SCHEMA IF NOT EXISTS audit; CREATE SCHEMA IF NOT EXISTS budget;";
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
