using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607200006_CategoriesMerchantsAndSplits")]
public sealed class BudgetCategoriesMerchantsMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE budget.categories ADD COLUMN IF NOT EXISTS icon varchar(64) NOT NULL DEFAULT 'tag';
        ALTER TABLE budget.categories ADD COLUMN IF NOT EXISTS archived_at timestamp;
        CREATE TABLE IF NOT EXISTS budget.category_versions (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            category_id uuid NOT NULL REFERENCES budget.categories(id) ON DELETE RESTRICT,
            name varchar(255) NOT NULL, color varchar(32) NOT NULL, icon varchar(64) NOT NULL,
            behavior varchar(64) NOT NULL, archived boolean NOT NULL DEFAULT false,
            effective_from timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_category_versions_owner_category
            ON budget.category_versions(owner_user_id, category_id, effective_from DESC);
        INSERT INTO budget.category_versions (owner_user_id, category_id, name, color, icon, behavior, archived, effective_from)
        SELECT owner_user_id, id, name, color, icon, behavior, archived_at IS NOT NULL, created_at FROM budget.categories
        WHERE NOT EXISTS (SELECT 1 FROM budget.category_versions version WHERE version.category_id = categories.id);
        ALTER TABLE budget.ledger_entries ADD COLUMN IF NOT EXISTS merchant_raw varchar(255) NOT NULL DEFAULT '';
        ALTER TABLE budget.ledger_entries ADD COLUMN IF NOT EXISTS merchant_normalized varchar(255) NOT NULL DEFAULT '';
        ALTER TABLE budget.ledger_entries ADD COLUMN IF NOT EXISTS merchant_brand_key varchar(64);
        CREATE INDEX IF NOT EXISTS idx_budget_ledger_owner_merchant ON budget.ledger_entries(owner_user_id, merchant_normalized);
        CREATE TABLE IF NOT EXISTS budget.ledger_splits (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            ledger_entry_id uuid NOT NULL REFERENCES budget.ledger_entries(id) ON DELETE RESTRICT,
            category_id uuid REFERENCES budget.categories(id) ON DELETE SET NULL,
            category_version_id uuid REFERENCES budget.category_versions(id) ON DELETE SET NULL,
            category_name_snapshot varchar(255) NOT NULL, category_color_snapshot varchar(32) NOT NULL,
            category_icon_snapshot varchar(64) NOT NULL, amount_cents bigint NOT NULL CHECK (amount_cents > 0),
            ordinary_impact_cents bigint NOT NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_ledger_splits_owner_entry ON budget.ledger_splits(owner_user_id, ledger_entry_id);
        INSERT INTO budget.ledger_splits (
            owner_user_id, ledger_entry_id, category_id, category_version_id, category_name_snapshot,
            category_color_snapshot, category_icon_snapshot, amount_cents, ordinary_impact_cents, created_at)
        SELECT entry.owner_user_id, entry.id, entry.category_id, version.id,
            COALESCE(version.name, 'Uncategorized'), COALESCE(version.color, '#64748b'), COALESCE(version.icon, 'tag'),
            entry.amount_cents, entry.ordinary_impact_cents, entry.created_at
        FROM budget.ledger_entries entry
        LEFT JOIN LATERAL (
            SELECT * FROM budget.category_versions candidate
            WHERE candidate.category_id = entry.category_id AND candidate.effective_from <= entry.created_at
            ORDER BY candidate.effective_from DESC LIMIT 1) version ON true
        WHERE entry.kind = 'expense' AND NOT EXISTS (
            SELECT 1 FROM budget.ledger_splits split WHERE split.ledger_entry_id = entry.id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
