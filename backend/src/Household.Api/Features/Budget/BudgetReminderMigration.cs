using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607230017_BudgetReminders")]
public sealed class BudgetReminderMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS budget.reminder_settings (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL,
            plan_kind varchar(16) NOT NULL CHECK (plan_kind IN ('income', 'commitment')),
            series_id uuid NOT NULL,
            due_enabled boolean NOT NULL DEFAULT false,
            overdue_enabled boolean NOT NULL DEFAULT false,
            updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, plan_kind, series_id));
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
