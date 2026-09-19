using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607230015_InvestmentEvents")]
public sealed class BudgetInvestmentsMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS budget.investment_events (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            period_id uuid NOT NULL REFERENCES budget.periods(id) ON DELETE RESTRICT,
            idempotency_key varchar(128), kind varchar(16) NOT NULL
                CHECK (kind IN ('opening', 'contribution', 'valuation', 'withdrawal')),
            occurred_on date NOT NULL, description varchar(512) NOT NULL,
            amount_cents bigint NOT NULL
                CHECK (amount_cents >= 0 AND (kind = 'valuation' OR amount_cents > 0)),
            destination varchar(16), target_purpose_id uuid
                REFERENCES budget.savings_purposes(id) ON DELETE RESTRICT,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (
                (kind = 'withdrawal' AND destination IN ('buffer', 'savings', 'ordinary')) OR
                (kind <> 'withdrawal' AND destination IS NULL AND target_purpose_id IS NULL)),
            CHECK (
                destination = 'savings' AND target_purpose_id IS NOT NULL OR
                destination <> 'savings' AND target_purpose_id IS NULL OR
                destination IS NULL),
            UNIQUE(owner_user_id, idempotency_key));
        CREATE INDEX IF NOT EXISTS idx_budget_investment_events_period
            ON budget.investment_events(owner_user_id, period_id, occurred_on);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
