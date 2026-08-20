using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202608050018_BudgetImport")]
public sealed class BudgetImportMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS budget.import_sessions (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            file_name varchar(255) NOT NULL DEFAULT '',
            status varchar(16) NOT NULL DEFAULT 'staged' CHECK (status IN ('staged', 'committed')),
            header_json text NOT NULL DEFAULT '[]',
            mapping_json text NOT NULL DEFAULT '',
            row_count integer NOT NULL DEFAULT 0,
            committed_entries integer NOT NULL DEFAULT 0,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            committed_at timestamp);
        CREATE INDEX IF NOT EXISTS idx_budget_import_sessions_owner
            ON budget.import_sessions(owner_user_id, created_at);
        CREATE TABLE IF NOT EXISTS budget.import_rows (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            session_id uuid NOT NULL REFERENCES budget.import_sessions(id) ON DELETE CASCADE,
            row_number integer NOT NULL,
            raw_json text NOT NULL DEFAULT '[]',
            kind varchar(16) NOT NULL DEFAULT '',
            occurred_on date,
            description varchar(512) NOT NULL DEFAULT '',
            amount_cents bigint NOT NULL DEFAULT 0,
            category_name varchar(255) NOT NULL DEFAULT '',
            merchant varchar(255) NOT NULL DEFAULT '',
            validation_error varchar(512) NOT NULL DEFAULT '',
            duplicate_warning boolean NOT NULL DEFAULT false,
            ledger_entry_id uuid,
            UNIQUE(session_id, row_number));
        CREATE INDEX IF NOT EXISTS idx_budget_import_rows_session
            ON budget.import_rows(owner_user_id, session_id, row_number);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
