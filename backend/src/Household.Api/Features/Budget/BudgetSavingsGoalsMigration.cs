using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607230014_SavingsGoalsAndPurchases")]
public sealed class BudgetSavingsGoalsMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE budget.savings_purposes
            ADD COLUMN IF NOT EXISTS target_amount_cents bigint,
            ADD COLUMN IF NOT EXISTS planning_mode varchar(16),
            ADD COLUMN IF NOT EXISTS plan_started_on date,
            ADD COLUMN IF NOT EXISTS plan_start_allocated_cents bigint NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS target_date date,
            ADD COLUMN IF NOT EXISTS recurring_contribution_cents bigint,
            ADD COLUMN IF NOT EXISTS contributions_paused boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS completed_at timestamp,
            ADD CONSTRAINT ck_savings_purpose_target
                CHECK (target_amount_cents IS NULL OR target_amount_cents > 0),
            ADD CONSTRAINT ck_savings_purpose_plan
                CHECK (planning_mode IS NULL OR planning_mode IN ('date', 'rate'));

        CREATE TABLE IF NOT EXISTS budget.savings_purchases (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            period_id uuid NOT NULL REFERENCES budget.periods(id) ON DELETE RESTRICT,
            ledger_entry_id uuid NOT NULL REFERENCES budget.ledger_entries(id) ON DELETE RESTRICT,
            idempotency_key varchar(128) NOT NULL,
            occurred_on date NOT NULL, description varchar(512) NOT NULL,
            amount_cents bigint NOT NULL CHECK (amount_cents > 0),
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, idempotency_key),
            UNIQUE(owner_user_id, ledger_entry_id));
        CREATE INDEX IF NOT EXISTS idx_budget_savings_purchases_period
            ON budget.savings_purchases(owner_user_id, period_id, occurred_on);

        CREATE TABLE IF NOT EXISTS budget.savings_purchase_funding (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            purchase_id uuid NOT NULL REFERENCES budget.savings_purchases(id) ON DELETE RESTRICT,
            sequence integer NOT NULL CHECK (sequence >= 0),
            source varchar(16) NOT NULL CHECK (source IN ('goal', 'ordinary')),
            purpose_id uuid REFERENCES budget.savings_purposes(id) ON DELETE RESTRICT,
            amount_cents bigint NOT NULL CHECK (amount_cents > 0),
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK ((source = 'goal' AND purpose_id IS NOT NULL) OR
                   (source = 'ordinary' AND purpose_id IS NULL)),
            UNIQUE(owner_user_id, purchase_id, sequence));
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
