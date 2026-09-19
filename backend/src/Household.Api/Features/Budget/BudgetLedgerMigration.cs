using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607200005_AppendOnlyLedger")]
public sealed class BudgetLedgerMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS budget.ledger_entries (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            period_id uuid NOT NULL REFERENCES budget.periods(id) ON DELETE RESTRICT,
            category_id uuid REFERENCES budget.categories(id) ON DELETE SET NULL,
            kind varchar(32) NOT NULL, occurred_on date NOT NULL, description varchar(512) NOT NULL,
            amount_cents bigint NOT NULL CHECK (amount_cents > 0), ordinary_impact_cents bigint NOT NULL,
            source varchar(64) NOT NULL DEFAULT 'manual', source_record_id uuid, legacy_transaction_id uuid UNIQUE,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (kind IN ('income', 'expense')));
        CREATE INDEX IF NOT EXISTS idx_budget_ledger_owner_date ON budget.ledger_entries(owner_user_id, occurred_on DESC);
        CREATE INDEX IF NOT EXISTS idx_budget_ledger_owner_period ON budget.ledger_entries(owner_user_id, period_id);
        INSERT INTO budget.ledger_entries (
            owner_user_id, period_id, category_id, kind, occurred_on, description, amount_cents,
            ordinary_impact_cents, source, legacy_transaction_id, created_at)
        SELECT owner_user_id, period_id, category_id, 'expense', occurred_on, description, amount_cents,
            CASE WHEN include_in_limit THEN -amount_cents ELSE 0 END, 'legacy_transaction', id, created_at
        FROM budget.transactions
        ON CONFLICT (legacy_transaction_id) DO NOTHING;
        CREATE TABLE IF NOT EXISTS budget.migration_issues (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, code varchar(64) NOT NULL,
            legacy_record_type varchar(64) NOT NULL, legacy_record_id uuid NOT NULL, detail varchar(1024) NOT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, code, legacy_record_id));
        INSERT INTO budget.migration_issues (owner_user_id, code, legacy_record_type, legacy_record_id, detail)
        SELECT owner_user_id, 'legacy_account_balance_not_imported', 'account', id,
            'The mutable legacy account balance was retained for audit but cannot safely fund the one-ledger budget.'
        FROM budget.accounts WHERE balance_cents <> 0
        ON CONFLICT (owner_user_id, code, legacy_record_id) DO NOTHING;
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
