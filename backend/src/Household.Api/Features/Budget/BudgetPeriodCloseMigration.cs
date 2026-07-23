using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607230012_ExplicitPeriodClose")]
public sealed class BudgetPeriodCloseMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE budget.settings
            ADD COLUMN IF NOT EXISTS default_buffer_disposition varchar(16) NOT NULL DEFAULT 'retain'
                CHECK (default_buffer_disposition IN ('retain', 'ordinary', 'savings', 'investment'));

        CREATE TABLE IF NOT EXISTS budget.period_closes (
            id uuid PRIMARY KEY DEFAULT uuidv7(),
            owner_user_id uuid NOT NULL,
            period_id uuid NOT NULL REFERENCES budget.periods(id) ON DELETE RESTRICT,
            forecast_buffer_target_cents bigint NOT NULL CHECK (forecast_buffer_target_cents >= 0),
            actual_buffer_target_cents bigint NOT NULL CHECK (actual_buffer_target_cents >= 0),
            funded_buffer_cents bigint NOT NULL CHECK (funded_buffer_cents >= 0),
            buffer_shortfall_cents bigint NOT NULL CHECK (buffer_shortfall_cents >= 0),
            deficit_cents bigint NOT NULL CHECK (deficit_cents >= 0),
            covered_from_buffer_cents bigint NOT NULL CHECK (covered_from_buffer_cents >= 0),
            carried_deficit_cents bigint NOT NULL CHECK (carried_deficit_cents >= 0),
            disposition varchar(16) NOT NULL
                CHECK (disposition IN ('retain', 'ordinary', 'savings', 'investment')),
            disposition_amount_cents bigint NOT NULL CHECK (disposition_amount_cents >= 0),
            retained_buffer_cents bigint NOT NULL CHECK (retained_buffer_cents >= 0),
            closed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, period_id));
        CREATE INDEX IF NOT EXISTS idx_budget_period_closes_owner
            ON budget.period_closes(owner_user_id, closed_at);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
