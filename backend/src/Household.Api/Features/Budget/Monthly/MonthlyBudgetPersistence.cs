using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

public sealed partial class BudgetDbContext
{
    public DbSet<MonthlyPlanRow> MonthlyPlans => this.Set<MonthlyPlanRow>();
    public DbSet<MonthlyCategoryRow> MonthlyCategories => this.Set<MonthlyCategoryRow>();
    public DbSet<MonthlyEntryRow> MonthlyEntries => this.Set<MonthlyEntryRow>();

    private static void ConfigureMonthlyBudget(ModelBuilder model)
    {
        EntityTypeBuilder<MonthlyPlanRow> plan = model.Entity<MonthlyPlanRow>();
        plan.ToTable("monthly_plans");
        plan.HasKey(row => row.Id);
        plan.Property(row => row.Id).HasColumnName("id");
        plan.Property(row => row.OwnerUserId).HasColumnName("owner_user_id");
        plan.Property(row => row.Revision).HasColumnName("revision");
        plan.Property(row => row.EffectiveFrom).HasColumnName("effective_from");
        plan.Property(row => row.StartDay).HasColumnName("start_day");
        plan.Property(row => row.Currency).HasColumnName("currency");
        plan.Property(row => row.TimeZoneId).HasColumnName("time_zone_id");
        plan.Property(row => row.OpeningSavingsCents).HasColumnName("opening_savings_cents");
        plan.Property(row => row.PlanJson).HasColumnName("plan_json").HasColumnType("jsonb");
        plan.HasIndex(row => new { row.OwnerUserId, row.Revision }).IsUnique();

        EntityTypeBuilder<MonthlyCategoryRow> category = model.Entity<MonthlyCategoryRow>();
        category.ToTable("monthly_categories");
        category.HasKey(row => row.Id);
        category.Property(row => row.Id).HasColumnName("id");
        category.Property(row => row.OwnerUserId).HasColumnName("owner_user_id");
        category.Property(row => row.Name).HasColumnName("name");
        category.Property(row => row.Archived).HasColumnName("archived");
        category.HasIndex(row => new { row.OwnerUserId, row.Name }).IsUnique();

        EntityTypeBuilder<MonthlyEntryRow> entry = model.Entity<MonthlyEntryRow>();
        entry.ToTable("monthly_entries");
        entry.HasKey(row => row.Id);
        entry.Property(row => row.Sequence).HasColumnName("sequence").ValueGeneratedOnAdd();
        entry.Property(row => row.Id).HasColumnName("id");
        entry.Property(row => row.OwnerUserId).HasColumnName("owner_user_id");
        entry.Property(row => row.RequestKey).HasColumnName("request_key");
        entry.Property(row => row.RequestJson).HasColumnName("request_json").HasColumnType("jsonb");
        entry.Property(row => row.OccurredOn).HasColumnName("occurred_on");
        entry.Property(row => row.Kind).HasColumnName("kind");
        entry.Property(row => row.RelatedId).HasColumnName("related_id");
        entry.Property(row => row.ExpenseJson).HasColumnName("expense_json").HasColumnType("jsonb");
        entry.Property(row => row.CreatedAt).HasColumnName("created_at");
        entry.HasIndex(row => new { row.OwnerUserId, row.RequestKey }).IsUnique();
    }
}

[DbContext(typeof(BudgetDbContext))]
[Migration("202609140001_MonthlyBudgetPreview")]
public sealed class MonthlyBudgetMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE budget.monthly_plans (
            id uuid PRIMARY KEY, owner_user_id uuid NOT NULL, revision bigint NOT NULL,
            effective_from date NOT NULL, start_day integer NOT NULL CHECK (start_day BETWEEN 1 AND 31),
            currency text NOT NULL, time_zone_id text NOT NULL,
            opening_savings_cents bigint NOT NULL CHECK (opening_savings_cents >= 0), plan_json jsonb NOT NULL,
            UNIQUE (owner_user_id, revision));
        CREATE TABLE budget.monthly_categories (
            id uuid PRIMARY KEY, owner_user_id uuid NOT NULL, name text NOT NULL,
            archived boolean NOT NULL DEFAULT false, UNIQUE (owner_user_id, name));
        CREATE TABLE budget.monthly_entries (
            id uuid PRIMARY KEY, sequence bigint GENERATED ALWAYS AS IDENTITY, owner_user_id uuid NOT NULL, request_key text NOT NULL,
            request_json jsonb NOT NULL, occurred_on date NOT NULL,
            kind text NOT NULL CHECK (kind IN ('expense', 'refund', 'void')),
            related_id uuid REFERENCES budget.monthly_entries(id), expense_json jsonb NOT NULL,
            created_at timestamp with time zone NOT NULL,
            UNIQUE (owner_user_id, request_key));
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TABLE budget.monthly_entries;
        DROP TABLE budget.monthly_categories;
        DROP TABLE budget.monthly_plans;
        """);
}
