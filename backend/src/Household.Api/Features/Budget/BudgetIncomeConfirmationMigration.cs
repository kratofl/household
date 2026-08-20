using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607200009_IncomeConfirmationAndVariance")]
public sealed class BudgetIncomeConfirmationMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE budget.income_plans ADD COLUMN IF NOT EXISTS automatic_posting boolean NOT NULL DEFAULT false;

        CREATE TABLE IF NOT EXISTS budget.income_postings (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, series_id uuid NOT NULL,
            version_id uuid NOT NULL REFERENCES budget.income_plans(id) ON DELETE RESTRICT,
            scheduled_on date NOT NULL, expected_on date NOT NULL, actual_on date NOT NULL,
            expected_amount_cents bigint NOT NULL CHECK (expected_amount_cents > 0),
            actual_amount_cents bigint NOT NULL CHECK (actual_amount_cents > 0), variance_cents bigint NOT NULL,
            posting_mode varchar(16) NOT NULL CHECK (posting_mode IN ('manual', 'automatic')),
            ledger_entry_id uuid NOT NULL REFERENCES budget.ledger_entries(id) ON DELETE RESTRICT,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, series_id, scheduled_on));
        CREATE INDEX IF NOT EXISTS idx_budget_income_postings_ledger ON budget.income_postings(ledger_entry_id);

        CREATE TABLE IF NOT EXISTS budget.income_variance_rules (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, series_id uuid,
            mode varchar(16) NOT NULL CHECK (mode IN ('fixed', 'percentage')),
            effective_from timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_income_variance_rules_effective
            ON budget.income_variance_rules(owner_user_id, series_id, effective_from);
        CREATE TABLE IF NOT EXISTS budget.income_variance_rule_routes (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            rule_id uuid NOT NULL REFERENCES budget.income_variance_rules(id) ON DELETE RESTRICT,
            position integer NOT NULL, destination varchar(32) NOT NULL
                CHECK (destination IN ('buffer', 'ordinary', 'savings', 'investment')),
            target_id uuid, value bigint NOT NULL CHECK (value >= 0),
            UNIQUE(owner_user_id, rule_id, position));

        CREATE TABLE IF NOT EXISTS budget.income_variance_allocations (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            posting_id uuid NOT NULL REFERENCES budget.income_postings(id) ON DELETE RESTRICT,
            destination varchar(32) NOT NULL CHECK (destination IN ('buffer', 'ordinary', 'savings', 'investment')),
            target_id uuid, amount_cents bigint NOT NULL CHECK (amount_cents > 0),
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_income_variance_allocations_posting
            ON budget.income_variance_allocations(owner_user_id, posting_id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
