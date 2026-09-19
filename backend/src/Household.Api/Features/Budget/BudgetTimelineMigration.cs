using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607200007_AuditableTimeline")]
public sealed class BudgetTimelineMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE budget.ledger_entries ADD COLUMN IF NOT EXISTS corrects_entry_id uuid REFERENCES budget.ledger_entries(id) ON DELETE RESTRICT;
        ALTER TABLE budget.ledger_entries ADD COLUMN IF NOT EXISTS related_entry_id uuid REFERENCES budget.ledger_entries(id) ON DELETE RESTRICT;
        ALTER TABLE budget.ledger_entries ADD COLUMN IF NOT EXISTS change_reason varchar(1024) NOT NULL DEFAULT '';
        ALTER TABLE budget.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_kind_check;
        ALTER TABLE budget.ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK (kind IN ('income', 'expense', 'refund'));
        CREATE INDEX IF NOT EXISTS idx_budget_ledger_corrects ON budget.ledger_entries(corrects_entry_id);
        CREATE INDEX IF NOT EXISTS idx_budget_ledger_related ON budget.ledger_entries(related_entry_id);
        CREATE TABLE IF NOT EXISTS budget.ledger_actions (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            ledger_entry_id uuid NOT NULL REFERENCES budget.ledger_entries(id) ON DELETE RESTRICT,
            kind varchar(32) NOT NULL CHECK (kind IN ('void')), reason varchar(1024) NOT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_ledger_actions_owner_entry ON budget.ledger_actions(owner_user_id, ledger_entry_id, kind);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
