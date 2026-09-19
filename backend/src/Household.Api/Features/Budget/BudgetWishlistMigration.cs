using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607230016_BudgetWishlist")]
public sealed class BudgetWishlistMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS budget.wishlist_items (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            name varchar(255) NOT NULL,
            estimated_price_cents bigint CHECK (estimated_price_cents IS NULL OR estimated_price_cents > 0),
            priority varchar(16) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
            notes varchar(2048) NOT NULL DEFAULT '',
            status varchar(16) NOT NULL CHECK (status IN ('active', 'completed', 'removed')),
            savings_goal_id uuid REFERENCES budget.savings_purposes(id) ON DELETE RESTRICT,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_wishlist_status
            ON budget.wishlist_items(owner_user_id, status, priority);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
