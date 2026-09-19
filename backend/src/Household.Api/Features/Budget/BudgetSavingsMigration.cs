using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607230013_SavingsContributions")]
public sealed class BudgetSavingsMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS budget.savings_purposes (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            name varchar(255) NOT NULL, archived_at timestamp,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, name));
        CREATE TABLE IF NOT EXISTS budget.savings_contributions (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            period_id uuid NOT NULL REFERENCES budget.periods(id) ON DELETE RESTRICT,
            idempotency_key varchar(128), kind varchar(16) NOT NULL
                CHECK (kind IN ('contribution', 'opening')),
            occurred_on date NOT NULL, description varchar(512) NOT NULL,
            amount_cents bigint NOT NULL CHECK (amount_cents > 0),
            unallocated_cents bigint NOT NULL CHECK (unallocated_cents >= 0),
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, idempotency_key));
        CREATE INDEX IF NOT EXISTS idx_budget_savings_contributions_period
            ON budget.savings_contributions(owner_user_id, period_id, occurred_on);
        CREATE TABLE IF NOT EXISTS budget.savings_allocations (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            contribution_id uuid NOT NULL REFERENCES budget.savings_contributions(id) ON DELETE RESTRICT,
            purpose_id uuid NOT NULL REFERENCES budget.savings_purposes(id) ON DELETE RESTRICT,
            mode varchar(16) NOT NULL CHECK (mode IN ('fixed', 'percentage')),
            requested_value bigint NOT NULL CHECK (requested_value >= 0),
            amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, contribution_id, purpose_id));
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
