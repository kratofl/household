using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607200008_RecurringIncome")]
public sealed class BudgetRecurringIncomeMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE budget.income_plans ADD COLUMN IF NOT EXISTS series_id uuid;
        ALTER TABLE budget.income_plans ADD COLUMN IF NOT EXISTS interval_unit varchar(16) NOT NULL DEFAULT 'month';
        ALTER TABLE budget.income_plans ADD COLUMN IF NOT EXISTS interval_count integer NOT NULL DEFAULT 1;
        ALTER TABLE budget.income_plans ADD COLUMN IF NOT EXISTS weekdays varchar(32) NOT NULL DEFAULT '';
        ALTER TABLE budget.income_plans ADD COLUMN IF NOT EXISTS effective_from date;
        ALTER TABLE budget.income_plans ADD COLUMN IF NOT EXISTS effective_to date;
        ALTER TABLE budget.income_plans ADD COLUMN IF NOT EXISTS change_reason varchar(1024) NOT NULL DEFAULT '';
        UPDATE budget.income_plans SET series_id = id WHERE series_id IS NULL;
        UPDATE budget.income_plans SET effective_from = start_date WHERE effective_from IS NULL;
        ALTER TABLE budget.income_plans ALTER COLUMN series_id SET NOT NULL;
        ALTER TABLE budget.income_plans ALTER COLUMN effective_from SET NOT NULL;
        ALTER TABLE budget.income_plans DROP CONSTRAINT IF EXISTS income_plans_interval_count_check;
        ALTER TABLE budget.income_plans ADD CONSTRAINT income_plans_interval_count_check CHECK (interval_count > 0);
        CREATE INDEX IF NOT EXISTS idx_budget_income_plans_series_effective
            ON budget.income_plans(owner_user_id, series_id, effective_from);

        CREATE TABLE IF NOT EXISTS budget.income_plan_pauses (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, series_id uuid NOT NULL,
            pause_from date NOT NULL, pause_through date NOT NULL, reason varchar(1024) NOT NULL DEFAULT '',
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (pause_through >= pause_from));
        CREATE INDEX IF NOT EXISTS idx_budget_income_pauses_series
            ON budget.income_plan_pauses(owner_user_id, series_id, pause_from);

        CREATE TABLE IF NOT EXISTS budget.income_plan_stops (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, series_id uuid NOT NULL,
            effective_on date NOT NULL, reason varchar(1024) NOT NULL DEFAULT '',
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_income_stops_series
            ON budget.income_plan_stops(owner_user_id, series_id, effective_on);

        CREATE TABLE IF NOT EXISTS budget.income_occurrence_overrides (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, series_id uuid NOT NULL,
            scheduled_on date NOT NULL, occurred_on date NOT NULL, name varchar(255) NOT NULL,
            amount_cents bigint NOT NULL CHECK (amount_cents > 0), reason varchar(1024) NOT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_income_overrides_occurrence
            ON budget.income_occurrence_overrides(owner_user_id, series_id, scheduled_on, created_at);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
