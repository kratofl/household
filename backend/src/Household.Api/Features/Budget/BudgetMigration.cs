using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607200003_AdoptLegacyBudget")]
public sealed class BudgetMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS budget.periods (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
            name varchar(255) NOT NULL, start_date date NOT NULL, end_date date NOT NULL, spending_limit_cents bigint NOT NULL DEFAULT 0,
            overspend_carryover_cents bigint NOT NULL DEFAULT 0, created_at timestamp DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp DEFAULT CURRENT_TIMESTAMP, UNIQUE(owner_user_id, start_date));
        CREATE TABLE IF NOT EXISTS budget.categories (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
            name varchar(255) NOT NULL, color varchar(32) NOT NULL, behavior varchar(64) NOT NULL DEFAULT 'include_in_limit',
            protected boolean NOT NULL DEFAULT false, created_at timestamp DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp DEFAULT CURRENT_TIMESTAMP, UNIQUE(owner_user_id, name));
        CREATE TABLE IF NOT EXISTS budget.accounts (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
            name varchar(255) NOT NULL, balance_cents bigint NOT NULL DEFAULT 0, created_at timestamp DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp DEFAULT CURRENT_TIMESTAMP, UNIQUE(owner_user_id, name));
        CREATE TABLE IF NOT EXISTS budget.planned_expenses (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
            account_id uuid NOT NULL REFERENCES budget.accounts(id) ON DELETE RESTRICT, category_id uuid REFERENCES budget.categories(id) ON DELETE SET NULL,
            name varchar(255) NOT NULL, kind varchar(64) NOT NULL DEFAULT 'fixed_cost', cadence varchar(64) NOT NULL DEFAULT 'monthly',
            amount_cents bigint NOT NULL, due_day integer NOT NULL DEFAULT 1, due_month integer, include_in_limit boolean NOT NULL DEFAULT true,
            active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS budget.transactions (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
            period_id uuid NOT NULL REFERENCES budget.periods(id) ON DELETE CASCADE, account_id uuid NOT NULL REFERENCES budget.accounts(id) ON DELETE RESTRICT,
            category_id uuid REFERENCES budget.categories(id) ON DELETE SET NULL, planned_expense_id uuid REFERENCES budget.planned_expenses(id) ON DELETE SET NULL,
            occurred_on date NOT NULL, description varchar(512) NOT NULL, amount_cents bigint NOT NULL,
            include_in_limit boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP);
        ALTER TABLE budget.transactions ADD COLUMN IF NOT EXISTS planned_expense_id uuid REFERENCES budget.planned_expenses(id) ON DELETE SET NULL;
        CREATE TABLE IF NOT EXISTS budget.planned_expense_applications (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
            planned_expense_id uuid NOT NULL REFERENCES budget.planned_expenses(id) ON DELETE CASCADE,
            period_id uuid NOT NULL REFERENCES budget.periods(id) ON DELETE CASCADE,
            transaction_id uuid NOT NULL REFERENCES budget.transactions(id) ON DELETE CASCADE,
            applied_at timestamp DEFAULT CURRENT_TIMESTAMP, UNIQUE(planned_expense_id, period_id));
        CREATE INDEX IF NOT EXISTS idx_budget_periods_owner ON budget.periods(owner_user_id);
        CREATE INDEX IF NOT EXISTS idx_budget_categories_owner ON budget.categories(owner_user_id);
        CREATE INDEX IF NOT EXISTS idx_budget_accounts_owner ON budget.accounts(owner_user_id);
        CREATE INDEX IF NOT EXISTS idx_budget_transactions_owner_period ON budget.transactions(owner_user_id, period_id);
        CREATE INDEX IF NOT EXISTS idx_budget_transactions_occurred_on ON budget.transactions(occurred_on);
        CREATE INDEX IF NOT EXISTS idx_budget_planned_expenses_owner ON budget.planned_expenses(owner_user_id);
        CREATE INDEX IF NOT EXISTS idx_budget_planned_applications_owner_period ON budget.planned_expense_applications(owner_user_id, period_id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
