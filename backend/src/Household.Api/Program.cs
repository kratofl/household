using System.Text.Json;
using Household.Api.Features.Audit;
using Household.Api.Features.Budget;
using Household.Api.Features.Identity;
using Household.Api.Features.Updates;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api;

public partial class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        var port = Environment.GetEnvironmentVariable("HOUSEHOLD_API_SERVER_PORT") ?? "8090";
        builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
        builder.Services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        });

        var connectionString = HouseholdConfiguration.ConnectionString(builder.Configuration);
        builder.Services.AddDbContext<IdentityDbContext>(options => ConfigurePostgres(options, connectionString, "identity"));
        builder.Services.AddDbContext<AuditDbContext>(options => ConfigurePostgres(options, connectionString, "audit"));
        builder.Services.AddDbContext<BudgetDbContext>(options => ConfigurePostgres(options, connectionString, "budget"));
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddScoped<IIdentityAccess, IdentityAccess>();
        builder.Services.AddScoped<AuditWriter>();
        builder.Services.AddScoped<BudgetService>();
        builder.Services.AddHttpClient<UpdatesClient>(client => client.Timeout = HouseholdConfiguration.UpdatesTimeout());

        var app = builder.Build();
        app.Use(async (context, next) =>
        {
            context.Response.Headers.ContentType = "application/json;charset=utf8";
            await next(context);
        });

        app.MapGet("/healthz", () => Results.NoContent());
        var api = app.MapGroup("/api/v1");
        api.MapIdentityEndpoints();
        api.MapAuditEndpoints();
        api.MapBudgetEndpoints();
        api.MapUpdateEndpoints();

        using (var scope = app.Services.CreateScope())
        {
            DatabaseMigration.ApplyAsync(scope.ServiceProvider).GetAwaiter().GetResult();
            IdentitySeed.ApplyAsync(scope.ServiceProvider).GetAwaiter().GetResult();
        }

        app.Run();
    }

    private static void ConfigurePostgres(DbContextOptionsBuilder options, string connectionString, string schema)
    {
        options.UseNpgsql(connectionString, npgsql =>
            npgsql.MigrationsHistoryTable("__EFMigrationsHistory", schema));
    }
}
