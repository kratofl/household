using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607200004_BudgetSetupAndPeriods")]
public sealed class BudgetSetupMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE budget.periods ADD COLUMN IF NOT EXISTS preferred_start_day integer NOT NULL DEFAULT 1;
        CREATE TABLE IF NOT EXISTS budget.settings (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL UNIQUE,
            base_currency varchar(3) NOT NULL DEFAULT 'EUR', preferred_period_start_day integer NOT NULL DEFAULT 1,
            buffer_rule varchar(32) NOT NULL DEFAULT 'fixed', buffer_amount_cents bigint NOT NULL DEFAULT 0,
            buffer_percentage_basis_points integer NOT NULL DEFAULT 0, setup_completed_at timestamp,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (preferred_period_start_day BETWEEN 1 AND 31), CHECK (buffer_amount_cents >= 0),
            CHECK (buffer_percentage_basis_points BETWEEN 0 AND 10000));
        CREATE TABLE IF NOT EXISTS budget.income_plans (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, name varchar(255) NOT NULL,
            amount_cents bigint NOT NULL CHECK (amount_cents > 0), cadence varchar(32) NOT NULL DEFAULT 'monthly',
            start_date date NOT NULL, active boolean NOT NULL DEFAULT true,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_income_plans_owner ON budget.income_plans(owner_user_id);
        CREATE TABLE IF NOT EXISTS budget.opening_allocations (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, kind varchar(32) NOT NULL,
            name varchar(255) NOT NULL DEFAULT '', amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
            occurred_on date NOT NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_opening_allocations_owner_date ON budget.opening_allocations(owner_user_id, occurred_on);
        INSERT INTO budget.settings (owner_user_id, base_currency, preferred_period_start_day, buffer_rule, setup_completed_at)
        SELECT owner_user_id, 'EUR', COALESCE(MIN(preferred_start_day), 1), 'fixed', CURRENT_TIMESTAMP
        FROM budget.periods GROUP BY owner_user_id
        ON CONFLICT (owner_user_id) DO NOTHING;
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
