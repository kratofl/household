using System.Security.Cryptography;
using System.Text;
using System.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Household.Api.Tests;

public sealed class LegacyParityFixture : IAsyncLifetime
{
    public const string AccessToken = "legacy-access-token";
    public const string RefreshToken = "legacy-refresh-token";
    public const string FreshAccessToken = "fresh-access-token";
    public const string LedgerAccessToken = "ledger-access-token";
    public const string SplitAccessToken = "split-access-token";
    public const string TimelineAccessToken = "timeline-access-token";
    public const string IncomeAccessToken = "income-access-token";
    public const string IncomeConfirmationAccessToken = "income-confirmation-access-token";
    public const string CommitmentAccessToken = "commitment-access-token";
    public const string ReservationAccessToken = "reservation-access-token";
    public const string BufferAccessToken = "buffer-access-token";
    public static readonly Guid AdminId = Guid.Parse("019bd5e4-6c31-7c48-8471-a42157389b3f");
    public static readonly Guid BudgetModuleId = Guid.Parse("019bd5e4-6c31-7c48-8471-a42157389b40");
    public static readonly Guid PeriodId = Guid.Parse("019bd5e4-6c31-7c48-8471-a42157389b42");
    public static readonly Guid CategoryId = Guid.Parse("019bd5e4-6c31-7c48-8471-a42157389b43");
    public static readonly Guid AccountId = Guid.Parse("019bd5e4-6c31-7c48-8471-a42157389b44");
    public static readonly Guid PlannedExpenseId = Guid.Parse("019bd5e4-6c31-7c48-8471-a42157389b46");
    public static readonly Guid FreshUserId = Guid.Parse("019bd5e4-6c31-7c48-8471-a42157389b47");

    private readonly string containerName = $"household-api-tests-{Guid.NewGuid():N}";
    private string connectionString = "";
    private WebApplicationFactory<Program>? factory;

    public HttpClient Client => (factory ?? throw new InvalidOperationException("Fixture has not started."))
        .CreateClient();

    public async Task InitializeAsync()
    {
        await StartDatabase();
        await SeedLegacyDatabase();
        factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Household", connectionString);
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Household"] = connectionString,
                    ["Seed:DemoUser"] = "false",
                    ["Updates:GitHubRepository"] = "kratofl/household",
                });
            });
        });
        _ = Client;
    }

    public async Task DisposeAsync()
    {
        if (factory is not null)
        {
            await factory.DisposeAsync();
        }

        await RunDocker("rm", "-f", containerName);
    }

    private async Task SeedLegacyDatabase()
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = LegacySchemaSql;
        command.Parameters.AddWithValue("passwordHash", BCrypt.Net.BCrypt.HashPassword("admin", 4));
        command.Parameters.AddWithValue("accessHash", HashToken(AccessToken));
        command.Parameters.AddWithValue("refreshHash", HashToken(RefreshToken));
        command.Parameters.AddWithValue("freshAccessHash", HashToken(FreshAccessToken));
        command.Parameters.AddWithValue("ledgerAccessHash", HashToken(LedgerAccessToken));
        command.Parameters.AddWithValue("splitAccessHash", HashToken(SplitAccessToken));
        command.Parameters.AddWithValue("timelineAccessHash", HashToken(TimelineAccessToken));
        command.Parameters.AddWithValue("incomeAccessHash", HashToken(IncomeAccessToken));
        command.Parameters.AddWithValue("incomeConfirmationAccessHash", HashToken(IncomeConfirmationAccessToken));
        command.Parameters.AddWithValue("commitmentAccessHash", HashToken(CommitmentAccessToken));
        command.Parameters.AddWithValue("reservationAccessHash", HashToken(ReservationAccessToken));
        command.Parameters.AddWithValue("bufferAccessHash", HashToken(BufferAccessToken));
        await command.ExecuteNonQueryAsync();
    }

    private static string HashToken(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private async Task StartDatabase()
    {
        await RunDocker("run", "--detach", "--rm", "--name", containerName,
            "--env", "POSTGRES_DB=household", "--env", "POSTGRES_USER=household",
            "--env", "POSTGRES_PASSWORD=household", "--publish", "127.0.0.1::5432",
            "postgres:18.4-alpine3.23");
        var portOutput = await RunDocker("port", containerName, "5432/tcp");
        var port = int.Parse(portOutput.Trim().Split(':')[^1]);
        connectionString = $"Host=127.0.0.1;Port={port};Database=household;Username=household;Password=household";
        var deadline = DateTime.UtcNow.AddSeconds(60);
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                await using var connection = new NpgsqlConnection(connectionString);
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
        var startInfo = new ProcessStartInfo("docker")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var argument in arguments) startInfo.ArgumentList.Add(argument);
        using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Could not start Docker CLI.");
        var output = await process.StandardOutput.ReadToEndAsync();
        var error = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        if (process.ExitCode != 0) throw new InvalidOperationException($"docker {string.Join(' ', arguments)} failed: {error}");
        return output;
    }

    private const string LegacySchemaSql = """
        CREATE SCHEMA identity;
        CREATE TABLE identity.users (
            id uuid PRIMARY KEY DEFAULT uuidv7(), name varchar(255) NOT NULL UNIQUE, email varchar(255) NOT NULL UNIQUE,
            password_hash varchar(255) NOT NULL, role varchar(32) NOT NULL, status varchar(32) NOT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE identity.modules (
            id uuid PRIMARY KEY DEFAULT uuidv7(), key varchar(255) NOT NULL UNIQUE, name varchar(255) NOT NULL,
            description varchar(1024) NOT NULL DEFAULT '', enabled boolean NOT NULL DEFAULT true,
            active boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE identity.sessions (
            id uuid PRIMARY KEY DEFAULT uuidv7(), user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
            access_token_hash varchar(64) NOT NULL UNIQUE, refresh_token_hash varchar(64) NOT NULL UNIQUE,
            access_expires_at timestamp NOT NULL, refresh_expires_at timestamp NOT NULL, revoked_at timestamp,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);

        INSERT INTO identity.users (id, name, email, password_hash, role, status)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b3f', 'admin', 'admin@household.local', @passwordHash, 'admin', 'active');
        INSERT INTO identity.modules (id, key, name, description, enabled, active)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b40', 'budget', 'Budget', 'Track expenses.', true, true);
        INSERT INTO identity.sessions (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b41', '019bd5e4-6c31-7c48-8471-a42157389b3f', @accessHash, @refreshHash,
                CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days');
        INSERT INTO identity.users (id, name, email, password_hash, role, status)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b47', 'fresh', 'fresh@household.local', @passwordHash, 'user', 'active');
        INSERT INTO identity.sessions (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b48', '019bd5e4-6c31-7c48-8471-a42157389b47', @freshAccessHash,
                'fresh-refresh-placeholder-hash', CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days');
        INSERT INTO identity.users (id, name, email, password_hash, role, status)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b49', 'ledger', 'ledger@household.local', @passwordHash, 'user', 'active');
        INSERT INTO identity.sessions (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b4a', '019bd5e4-6c31-7c48-8471-a42157389b49', @ledgerAccessHash,
                'ledger-refresh-placeholder-hash', CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days');
        INSERT INTO identity.users (id, name, email, password_hash, role, status)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b4b', 'split', 'split@household.local', @passwordHash, 'user', 'active');
        INSERT INTO identity.sessions (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b4c', '019bd5e4-6c31-7c48-8471-a42157389b4b', @splitAccessHash,
                'split-refresh-placeholder-hash', CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days');
        INSERT INTO identity.users (id, name, email, password_hash, role, status)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b4d', 'timeline', 'timeline@household.local', @passwordHash, 'user', 'active');
        INSERT INTO identity.sessions (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b4e', '019bd5e4-6c31-7c48-8471-a42157389b4d', @timelineAccessHash,
                'timeline-refresh-placeholder-hash', CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days');
        INSERT INTO identity.users (id, name, email, password_hash, role, status)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b4f', 'income', 'income@household.local', @passwordHash, 'user', 'active');
        INSERT INTO identity.sessions (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b50', '019bd5e4-6c31-7c48-8471-a42157389b4f', @incomeAccessHash,
                'income-refresh-placeholder-hash', CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days');
        INSERT INTO identity.users (id, name, email, password_hash, role, status)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b51', 'income-confirmation', 'income-confirmation@household.local', @passwordHash, 'user', 'active');
        INSERT INTO identity.sessions (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b52', '019bd5e4-6c31-7c48-8471-a42157389b51', @incomeConfirmationAccessHash,
                'income-confirmation-refresh-placeholder-hash', CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days');
        INSERT INTO identity.users (id, name, email, password_hash, role, status)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b53', 'commitment', 'commitment@household.local', @passwordHash, 'user', 'active');
        INSERT INTO identity.sessions (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b54', '019bd5e4-6c31-7c48-8471-a42157389b53', @commitmentAccessHash,
                'commitment-refresh-placeholder-hash', CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days');
        INSERT INTO identity.users (id, name, email, password_hash, role, status)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b55', 'reservation', 'reservation@household.local', @passwordHash, 'user', 'active');
        INSERT INTO identity.sessions (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b56', '019bd5e4-6c31-7c48-8471-a42157389b55', @reservationAccessHash,
                'reservation-refresh-placeholder-hash', CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days');
        INSERT INTO identity.users (id, name, email, password_hash, role, status)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b57', 'buffer', 'buffer@household.local', @passwordHash, 'user', 'active');
        INSERT INTO identity.sessions (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b58', '019bd5e4-6c31-7c48-8471-a42157389b57', @bufferAccessHash,
                'buffer-refresh-placeholder-hash', CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days');

        CREATE SCHEMA budget;
        CREATE TABLE budget.periods (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id), name varchar(255) NOT NULL,
            start_date date NOT NULL, end_date date NOT NULL, spending_limit_cents bigint NOT NULL DEFAULT 0,
            overspend_carryover_cents bigint NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(owner_user_id, start_date));
        CREATE TABLE budget.categories (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id), name varchar(255) NOT NULL,
            color varchar(32) NOT NULL, behavior varchar(64) NOT NULL DEFAULT 'include_in_limit', protected boolean NOT NULL DEFAULT false,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, name));
        CREATE TABLE budget.accounts (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id), name varchar(255) NOT NULL,
            balance_cents bigint NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(owner_user_id, name));
        CREATE TABLE budget.planned_expenses (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id), account_id uuid NOT NULL REFERENCES budget.accounts(id),
            category_id uuid REFERENCES budget.categories(id), name varchar(255) NOT NULL, kind varchar(64) NOT NULL,
            cadence varchar(64) NOT NULL, amount_cents bigint NOT NULL, due_day integer NOT NULL, due_month integer,
            include_in_limit boolean NOT NULL, active boolean NOT NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE budget.transactions (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id), period_id uuid NOT NULL REFERENCES budget.periods(id),
            account_id uuid NOT NULL REFERENCES budget.accounts(id), category_id uuid REFERENCES budget.categories(id),
            planned_expense_id uuid REFERENCES budget.planned_expenses(id), occurred_on date NOT NULL, description varchar(512) NOT NULL,
            amount_cents bigint NOT NULL, include_in_limit boolean NOT NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE budget.planned_expense_applications (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id), planned_expense_id uuid NOT NULL REFERENCES budget.planned_expenses(id),
            period_id uuid NOT NULL REFERENCES budget.periods(id), transaction_id uuid NOT NULL REFERENCES budget.transactions(id),
            applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(planned_expense_id, period_id));

        INSERT INTO budget.periods (id, owner_user_id, name, start_date, end_date, spending_limit_cents)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b42', '019bd5e4-6c31-7c48-8471-a42157389b3f', 'July 2026', '2026-07-01', '2026-07-31', 240000);
        INSERT INTO budget.categories (id, owner_user_id, name, color, behavior)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b43', '019bd5e4-6c31-7c48-8471-a42157389b3f', 'Food', '#16a34a', 'include_in_limit');
        INSERT INTO budget.accounts (id, owner_user_id, name, balance_cents)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b44', '019bd5e4-6c31-7c48-8471-a42157389b3f', 'Checking', 995800);
        INSERT INTO budget.transactions (id, owner_user_id, period_id, account_id, category_id, occurred_on, description, amount_cents, include_in_limit)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b45', '019bd5e4-6c31-7c48-8471-a42157389b3f',
                '019bd5e4-6c31-7c48-8471-a42157389b42', '019bd5e4-6c31-7c48-8471-a42157389b44',
                '019bd5e4-6c31-7c48-8471-a42157389b43', '2026-07-10', 'Groceries', 4200, true);
        INSERT INTO budget.planned_expenses (id, owner_user_id, account_id, category_id, name, kind, cadence, amount_cents, due_day, include_in_limit, active)
        VALUES ('019bd5e4-6c31-7c48-8471-a42157389b46', '019bd5e4-6c31-7c48-8471-a42157389b3f',
                '019bd5e4-6c31-7c48-8471-a42157389b44', '019bd5e4-6c31-7c48-8471-a42157389b43',
                'Legacy rent', 'fixed_cost', 'monthly', 80000, 5, true, true);
        """;
}
