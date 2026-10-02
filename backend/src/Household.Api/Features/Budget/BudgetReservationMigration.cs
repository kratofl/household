using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607230011_CommitmentReservations")]
public sealed class BudgetReservationMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE budget.commitment_plans
            ADD COLUMN IF NOT EXISTS charge_first_shortfall boolean NOT NULL DEFAULT false;
        ALTER TABLE budget.commitment_postings
            ADD COLUMN IF NOT EXISTS reservation_coverage_cents bigint NOT NULL DEFAULT 0
                CHECK (reservation_coverage_cents >= 0),
            ADD COLUMN IF NOT EXISTS direct_ordinary_impact_cents bigint NOT NULL DEFAULT 0;

        UPDATE budget.commitment_postings p
        SET direct_ordinary_impact_cents = l.ordinary_impact_cents
        FROM budget.ledger_entries l
        WHERE l.id = p.ledger_entry_id;
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
