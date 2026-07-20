using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public sealed class BudgetDbContext(DbContextOptions<BudgetDbContext> options) : DbContext(options)
{
    public DbSet<BudgetPeriod> Periods => Set<BudgetPeriod>();
    public DbSet<BudgetSettings> Settings => Set<BudgetSettings>();
    public DbSet<BudgetIncomePlan> IncomePlans => Set<BudgetIncomePlan>();
    public DbSet<BudgetOpeningAllocation> OpeningAllocations => Set<BudgetOpeningAllocation>();
    public DbSet<BudgetCategory> Categories => Set<BudgetCategory>();
    public DbSet<BudgetAccount> Accounts => Set<BudgetAccount>();
    public DbSet<BudgetTransaction> Transactions => Set<BudgetTransaction>();
    public DbSet<PlannedExpense> PlannedExpenses => Set<PlannedExpense>();
    public DbSet<PlannedExpenseApplication> PlannedExpenseApplications => Set<PlannedExpenseApplication>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("budget");
        ConfigurePeriod(modelBuilder.Entity<BudgetPeriod>());
        ConfigureSettings(modelBuilder.Entity<BudgetSettings>());
        ConfigureIncomePlan(modelBuilder.Entity<BudgetIncomePlan>());
        ConfigureOpeningAllocation(modelBuilder.Entity<BudgetOpeningAllocation>());
        ConfigureCategory(modelBuilder.Entity<BudgetCategory>());
        ConfigureAccount(modelBuilder.Entity<BudgetAccount>());
        ConfigureTransaction(modelBuilder.Entity<BudgetTransaction>());
        ConfigurePlannedExpense(modelBuilder.Entity<PlannedExpense>());
        ConfigureApplication(modelBuilder.Entity<PlannedExpenseApplication>());
    }

    private static void ConfigurePeriod(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetPeriod> entity)
    {
        entity.ToTable("periods"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.Name).HasColumnName("name");
        entity.Property(x => x.StartDate).HasColumnName("start_date");
        entity.Property(x => x.EndDate).HasColumnName("end_date");
        entity.Property(x => x.PreferredStartDay).HasColumnName("preferred_start_day");
        entity.Property(x => x.SpendingLimitCents).HasColumnName("spending_limit_cents");
        entity.Property(x => x.OverspendCarryoverCents).HasColumnName("overspend_carryover_cents");
        Timestamps(entity);
        entity.HasIndex(x => new { x.OwnerUserId, x.StartDate }).IsUnique();
    }

    private static void ConfigureSettings(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetSettings> entity)
    {
        entity.ToTable("settings"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.BaseCurrency).HasColumnName("base_currency");
        entity.Property(x => x.PreferredPeriodStartDay).HasColumnName("preferred_period_start_day");
        entity.Property(x => x.BufferRule).HasColumnName("buffer_rule");
        entity.Property(x => x.BufferAmountCents).HasColumnName("buffer_amount_cents");
        entity.Property(x => x.BufferPercentageBasisPoints).HasColumnName("buffer_percentage_basis_points");
        entity.Property(x => x.SetupCompletedAt).HasColumnName("setup_completed_at").HasColumnType("timestamp without time zone");
        Timestamps(entity);
        entity.HasIndex(x => x.OwnerUserId).IsUnique();
    }

    private static void ConfigureIncomePlan(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetIncomePlan> entity)
    {
        entity.ToTable("income_plans"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.Name).HasColumnName("name");
        entity.Property(x => x.AmountCents).HasColumnName("amount_cents");
        entity.Property(x => x.Cadence).HasColumnName("cadence");
        entity.Property(x => x.StartDate).HasColumnName("start_date");
        entity.Property(x => x.Active).HasColumnName("active");
        Timestamps(entity);
        entity.HasIndex(x => new { x.OwnerUserId, x.Name });
    }

    private static void ConfigureOpeningAllocation(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetOpeningAllocation> entity)
    {
        entity.ToTable("opening_allocations"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.Kind).HasColumnName("kind");
        entity.Property(x => x.Name).HasColumnName("name");
        entity.Property(x => x.AmountCents).HasColumnName("amount_cents");
        entity.Property(x => x.OccurredOn).HasColumnName("occurred_on");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.OccurredOn });
    }

    private static void ConfigureCategory(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetCategory> entity)
    {
        entity.ToTable("categories"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.Name).HasColumnName("name");
        entity.Property(x => x.Color).HasColumnName("color");
        entity.Property(x => x.Behavior).HasColumnName("behavior");
        entity.Property(x => x.Protected).HasColumnName("protected");
        Timestamps(entity);
        entity.HasIndex(x => new { x.OwnerUserId, x.Name }).IsUnique();
    }

    private static void ConfigureAccount(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetAccount> entity)
    {
        entity.ToTable("accounts"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.Name).HasColumnName("name");
        entity.Property(x => x.BalanceCents).HasColumnName("balance_cents");
        Timestamps(entity);
        entity.HasIndex(x => new { x.OwnerUserId, x.Name }).IsUnique();
    }

    private static void ConfigureTransaction(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetTransaction> entity)
    {
        entity.ToTable("transactions"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.PeriodId).HasColumnName("period_id");
        entity.Property(x => x.AccountId).HasColumnName("account_id");
        entity.Property(x => x.CategoryId).HasColumnName("category_id");
        entity.Property(x => x.PlannedExpenseId).HasColumnName("planned_expense_id");
        entity.Property(x => x.OccurredOn).HasColumnName("occurred_on");
        entity.Property(x => x.Description).HasColumnName("description");
        entity.Property(x => x.AmountCents).HasColumnName("amount_cents");
        entity.Property(x => x.IncludeInLimit).HasColumnName("include_in_limit");
        Timestamps(entity);
    }

    private static void ConfigurePlannedExpense(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<PlannedExpense> entity)
    {
        entity.ToTable("planned_expenses"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.AccountId).HasColumnName("account_id");
        entity.Property(x => x.CategoryId).HasColumnName("category_id");
        entity.Property(x => x.Name).HasColumnName("name");
        entity.Property(x => x.Kind).HasColumnName("kind");
        entity.Property(x => x.Cadence).HasColumnName("cadence");
        entity.Property(x => x.AmountCents).HasColumnName("amount_cents");
        entity.Property(x => x.DueDay).HasColumnName("due_day");
        entity.Property(x => x.DueMonth).HasColumnName("due_month");
        entity.Property(x => x.IncludeInLimit).HasColumnName("include_in_limit");
        entity.Property(x => x.Active).HasColumnName("active");
        Timestamps(entity);
    }

    private static void ConfigureApplication(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<PlannedExpenseApplication> entity)
    {
        entity.ToTable("planned_expense_applications"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.PlannedExpenseId).HasColumnName("planned_expense_id");
        entity.Property(x => x.PeriodId).HasColumnName("period_id");
        entity.Property(x => x.TransactionId).HasColumnName("transaction_id");
        entity.Property(x => x.AppliedAt).HasColumnName("applied_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.PlannedExpenseId, x.PeriodId }).IsUnique();
    }

    private static void Timestamps<TEntity>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<TEntity> entity)
        where TEntity : class
    {
        entity.Property<DateTime>("CreatedAt").HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.Property<DateTime>("UpdatedAt").HasColumnName("updated_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
    }
}
