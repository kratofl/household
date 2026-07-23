using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public sealed class BudgetDbContext(DbContextOptions<BudgetDbContext> options) : DbContext(options)
{
    public DbSet<BudgetPeriod> Periods => Set<BudgetPeriod>();
    public DbSet<BudgetSettings> Settings => Set<BudgetSettings>();
    public DbSet<BudgetIncomePlan> IncomePlans => Set<BudgetIncomePlan>();
    public DbSet<BudgetIncomePlanPause> IncomePlanPauses => Set<BudgetIncomePlanPause>();
    public DbSet<BudgetIncomePlanStop> IncomePlanStops => Set<BudgetIncomePlanStop>();
    public DbSet<BudgetIncomeOccurrenceOverride> IncomeOccurrenceOverrides => Set<BudgetIncomeOccurrenceOverride>();
    public DbSet<BudgetIncomePosting> IncomePostings => Set<BudgetIncomePosting>();
    public DbSet<BudgetIncomeVarianceRule> IncomeVarianceRules => Set<BudgetIncomeVarianceRule>();
    public DbSet<BudgetIncomeVarianceRuleRoute> IncomeVarianceRuleRoutes => Set<BudgetIncomeVarianceRuleRoute>();
    public DbSet<BudgetIncomeVarianceAllocation> IncomeVarianceAllocations => Set<BudgetIncomeVarianceAllocation>();
    public DbSet<BudgetOpeningAllocation> OpeningAllocations => Set<BudgetOpeningAllocation>();
    public DbSet<BudgetLedgerEntry> LedgerEntries => Set<BudgetLedgerEntry>();
    public DbSet<BudgetMigrationIssue> MigrationIssues => Set<BudgetMigrationIssue>();
    public DbSet<BudgetLedgerSplit> LedgerSplits => Set<BudgetLedgerSplit>();
    public DbSet<BudgetCategoryVersion> CategoryVersions => Set<BudgetCategoryVersion>();
    public DbSet<BudgetLedgerAction> LedgerActions => Set<BudgetLedgerAction>();
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
        ConfigureIncomePlanPause(modelBuilder.Entity<BudgetIncomePlanPause>());
        ConfigureIncomePlanStop(modelBuilder.Entity<BudgetIncomePlanStop>());
        ConfigureIncomeOccurrenceOverride(modelBuilder.Entity<BudgetIncomeOccurrenceOverride>());
        ConfigureIncomePosting(modelBuilder.Entity<BudgetIncomePosting>());
        ConfigureIncomeVarianceRule(modelBuilder.Entity<BudgetIncomeVarianceRule>());
        ConfigureIncomeVarianceRuleRoute(modelBuilder.Entity<BudgetIncomeVarianceRuleRoute>());
        ConfigureIncomeVarianceAllocation(modelBuilder.Entity<BudgetIncomeVarianceAllocation>());
        ConfigureOpeningAllocation(modelBuilder.Entity<BudgetOpeningAllocation>());
        ConfigureLedgerEntry(modelBuilder.Entity<BudgetLedgerEntry>());
        ConfigureMigrationIssue(modelBuilder.Entity<BudgetMigrationIssue>());
        ConfigureLedgerSplit(modelBuilder.Entity<BudgetLedgerSplit>());
        ConfigureCategoryVersion(modelBuilder.Entity<BudgetCategoryVersion>());
        ConfigureLedgerAction(modelBuilder.Entity<BudgetLedgerAction>());
        ConfigureCategory(modelBuilder.Entity<BudgetCategory>());
        ConfigureAccount(modelBuilder.Entity<BudgetAccount>());
        ConfigureTransaction(modelBuilder.Entity<BudgetTransaction>());
        ConfigurePlannedExpense(modelBuilder.Entity<PlannedExpense>());
        ConfigureApplication(modelBuilder.Entity<PlannedExpenseApplication>());
    }

    private static void ConfigureLedgerEntry(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetLedgerEntry> entity)
    {
        entity.ToTable("ledger_entries"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.PeriodId).HasColumnName("period_id");
        entity.Property(x => x.CategoryId).HasColumnName("category_id");
        entity.Property(x => x.Kind).HasColumnName("kind");
        entity.Property(x => x.OccurredOn).HasColumnName("occurred_on");
        entity.Property(x => x.Description).HasColumnName("description");
        entity.Property(x => x.AmountCents).HasColumnName("amount_cents");
        entity.Property(x => x.OrdinaryImpactCents).HasColumnName("ordinary_impact_cents");
        entity.Property(x => x.Source).HasColumnName("source");
        entity.Property(x => x.MerchantRaw).HasColumnName("merchant_raw");
        entity.Property(x => x.MerchantNormalized).HasColumnName("merchant_normalized");
        entity.Property(x => x.MerchantBrandKey).HasColumnName("merchant_brand_key");
        entity.Property(x => x.SourceRecordId).HasColumnName("source_record_id");
        entity.Property(x => x.LegacyTransactionId).HasColumnName("legacy_transaction_id");
        entity.Property(x => x.CorrectsEntryId).HasColumnName("corrects_entry_id");
        entity.Property(x => x.RelatedEntryId).HasColumnName("related_entry_id");
        entity.Property(x => x.ChangeReason).HasColumnName("change_reason");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.OccurredOn });
        entity.HasIndex(x => x.LegacyTransactionId).IsUnique();
        entity.HasMany(x => x.Splits).WithOne().HasForeignKey(x => x.LedgerEntryId);
    }

    private static void ConfigureLedgerAction(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetLedgerAction> entity)
    {
        entity.ToTable("ledger_actions"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.LedgerEntryId).HasColumnName("ledger_entry_id");
        entity.Property(x => x.Kind).HasColumnName("kind");
        entity.Property(x => x.Reason).HasColumnName("reason");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.LedgerEntryId, x.Kind });
    }

    private static void ConfigureLedgerSplit(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetLedgerSplit> entity)
    {
        entity.ToTable("ledger_splits"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.LedgerEntryId).HasColumnName("ledger_entry_id");
        entity.Property(x => x.CategoryId).HasColumnName("category_id");
        entity.Property(x => x.CategoryVersionId).HasColumnName("category_version_id");
        entity.Property(x => x.CategoryNameSnapshot).HasColumnName("category_name_snapshot");
        entity.Property(x => x.CategoryColorSnapshot).HasColumnName("category_color_snapshot");
        entity.Property(x => x.CategoryIconSnapshot).HasColumnName("category_icon_snapshot");
        entity.Property(x => x.AmountCents).HasColumnName("amount_cents");
        entity.Property(x => x.OrdinaryImpactCents).HasColumnName("ordinary_impact_cents");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.LedgerEntryId });
    }

    private static void ConfigureCategoryVersion(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetCategoryVersion> entity)
    {
        entity.ToTable("category_versions"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.CategoryId).HasColumnName("category_id");
        entity.Property(x => x.Name).HasColumnName("name");
        entity.Property(x => x.Color).HasColumnName("color");
        entity.Property(x => x.Icon).HasColumnName("icon");
        entity.Property(x => x.Behavior).HasColumnName("behavior");
        entity.Property(x => x.Archived).HasColumnName("archived");
        entity.Property(x => x.EffectiveFrom).HasColumnName("effective_from").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.CategoryId, x.EffectiveFrom });
    }

    private static void ConfigureMigrationIssue(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetMigrationIssue> entity)
    {
        entity.ToTable("migration_issues"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.Code).HasColumnName("code");
        entity.Property(x => x.LegacyRecordType).HasColumnName("legacy_record_type");
        entity.Property(x => x.LegacyRecordId).HasColumnName("legacy_record_id");
        entity.Property(x => x.Detail).HasColumnName("detail");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.Code, x.LegacyRecordId }).IsUnique();
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
        entity.Property(x => x.SeriesId).HasColumnName("series_id");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.Name).HasColumnName("name");
        entity.Property(x => x.AmountCents).HasColumnName("amount_cents");
        entity.Property(x => x.Cadence).HasColumnName("cadence");
        entity.Property(x => x.IntervalUnit).HasColumnName("interval_unit");
        entity.Property(x => x.IntervalCount).HasColumnName("interval_count");
        entity.Property(x => x.Weekdays).HasColumnName("weekdays");
        entity.Property(x => x.StartDate).HasColumnName("start_date");
        entity.Property(x => x.EffectiveFrom).HasColumnName("effective_from");
        entity.Property(x => x.EffectiveTo).HasColumnName("effective_to");
        entity.Property(x => x.ChangeReason).HasColumnName("change_reason");
        entity.Property(x => x.AutomaticPosting).HasColumnName("automatic_posting");
        entity.Property(x => x.Active).HasColumnName("active");
        Timestamps(entity);
        entity.HasIndex(x => new { x.OwnerUserId, x.SeriesId, x.EffectiveFrom });
    }

    private static void ConfigureIncomePlanPause(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetIncomePlanPause> entity)
    {
        entity.ToTable("income_plan_pauses"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.SeriesId).HasColumnName("series_id");
        entity.Property(x => x.From).HasColumnName("pause_from");
        entity.Property(x => x.Through).HasColumnName("pause_through");
        entity.Property(x => x.Reason).HasColumnName("reason");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.SeriesId, x.From });
    }

    private static void ConfigureIncomePlanStop(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetIncomePlanStop> entity)
    {
        entity.ToTable("income_plan_stops"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.SeriesId).HasColumnName("series_id");
        entity.Property(x => x.EffectiveOn).HasColumnName("effective_on");
        entity.Property(x => x.Reason).HasColumnName("reason");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.SeriesId, x.EffectiveOn });
    }

    private static void ConfigureIncomeOccurrenceOverride(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetIncomeOccurrenceOverride> entity)
    {
        entity.ToTable("income_occurrence_overrides"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.SeriesId).HasColumnName("series_id");
        entity.Property(x => x.ScheduledOn).HasColumnName("scheduled_on");
        entity.Property(x => x.OccurredOn).HasColumnName("occurred_on");
        entity.Property(x => x.Name).HasColumnName("name");
        entity.Property(x => x.AmountCents).HasColumnName("amount_cents");
        entity.Property(x => x.Reason).HasColumnName("reason");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.SeriesId, x.ScheduledOn, x.CreatedAt });
    }

    private static void ConfigureIncomePosting(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetIncomePosting> entity)
    {
        entity.ToTable("income_postings"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.SeriesId).HasColumnName("series_id");
        entity.Property(x => x.VersionId).HasColumnName("version_id");
        entity.Property(x => x.ScheduledOn).HasColumnName("scheduled_on");
        entity.Property(x => x.ExpectedOn).HasColumnName("expected_on");
        entity.Property(x => x.ActualOn).HasColumnName("actual_on");
        entity.Property(x => x.ExpectedAmountCents).HasColumnName("expected_amount_cents");
        entity.Property(x => x.ActualAmountCents).HasColumnName("actual_amount_cents");
        entity.Property(x => x.VarianceCents).HasColumnName("variance_cents");
        entity.Property(x => x.PostingMode).HasColumnName("posting_mode");
        entity.Property(x => x.LedgerEntryId).HasColumnName("ledger_entry_id");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.SeriesId, x.ScheduledOn }).IsUnique();
        entity.HasMany(x => x.Allocations).WithOne().HasForeignKey(x => x.PostingId);
    }

    private static void ConfigureIncomeVarianceRule(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetIncomeVarianceRule> entity)
    {
        entity.ToTable("income_variance_rules"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.SeriesId).HasColumnName("series_id");
        entity.Property(x => x.Mode).HasColumnName("mode");
        entity.Property(x => x.EffectiveFrom).HasColumnName("effective_from").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.SeriesId, x.EffectiveFrom });
        entity.HasMany(x => x.Routes).WithOne().HasForeignKey(x => x.RuleId);
    }

    private static void ConfigureIncomeVarianceRuleRoute(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetIncomeVarianceRuleRoute> entity)
    {
        entity.ToTable("income_variance_rule_routes"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.RuleId).HasColumnName("rule_id");
        entity.Property(x => x.Position).HasColumnName("position");
        entity.Property(x => x.Destination).HasColumnName("destination");
        entity.Property(x => x.TargetId).HasColumnName("target_id");
        entity.Property(x => x.Value).HasColumnName("value");
        entity.HasIndex(x => new { x.OwnerUserId, x.RuleId, x.Position }).IsUnique();
    }

    private static void ConfigureIncomeVarianceAllocation(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<BudgetIncomeVarianceAllocation> entity)
    {
        entity.ToTable("income_variance_allocations"); entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
        entity.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        entity.Property(x => x.PostingId).HasColumnName("posting_id");
        entity.Property(x => x.Destination).HasColumnName("destination");
        entity.Property(x => x.TargetId).HasColumnName("target_id");
        entity.Property(x => x.AmountCents).HasColumnName("amount_cents");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
        entity.HasIndex(x => new { x.OwnerUserId, x.PostingId });
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
        entity.Property(x => x.Icon).HasColumnName("icon");
        entity.Property(x => x.Behavior).HasColumnName("behavior");
        entity.Property(x => x.Protected).HasColumnName("protected");
        entity.Property(x => x.ArchivedAt).HasColumnName("archived_at").HasColumnType("timestamp without time zone");
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
