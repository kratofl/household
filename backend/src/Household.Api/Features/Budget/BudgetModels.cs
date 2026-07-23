namespace Household.Api.Features.Budget;

public sealed class BudgetPeriod
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = "";
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int PreferredStartDay { get; set; } = 1;
    public long SpendingLimitCents { get; set; }
    public long OverspendCarryoverCents { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class BudgetSettings
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string BaseCurrency { get; set; } = "EUR";
    public int PreferredPeriodStartDay { get; set; } = 1;
    public string BufferRule { get; set; } = BudgetValues.FixedBuffer;
    public long BufferAmountCents { get; set; }
    public int BufferPercentageBasisPoints { get; set; }
    public string DefaultBufferDisposition { get; set; } = BudgetValues.Retain;
    public DateTime? SetupCompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class BudgetPeriodClose
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid PeriodId { get; set; }
    public long ForecastBufferTargetCents { get; set; }
    public long ActualBufferTargetCents { get; set; }
    public long FundedBufferCents { get; set; }
    public long BufferShortfallCents { get; set; }
    public long DeficitCents { get; set; }
    public long CoveredFromBufferCents { get; set; }
    public long CarriedDeficitCents { get; set; }
    public string Disposition { get; set; } = BudgetValues.Retain;
    public long DispositionAmountCents { get; set; }
    public long RetainedBufferCents { get; set; }
    public DateTime ClosedAt { get; set; }
}

public sealed class BudgetSavingsPurpose
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = "";
    public long? TargetAmountCents { get; set; }
    public string? PlanningMode { get; set; }
    public DateOnly? PlanStartedOn { get; set; }
    public long PlanStartAllocatedCents { get; set; }
    public DateOnly? TargetDate { get; set; }
    public long? RecurringContributionCents { get; set; }
    public bool ContributionsPaused { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? ArchivedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetSavingsContribution
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid PeriodId { get; set; }
    public string? IdempotencyKey { get; set; }
    public string Kind { get; set; } = BudgetValues.Contribution;
    public DateOnly OccurredOn { get; set; }
    public string Description { get; set; } = "";
    public long AmountCents { get; set; }
    public long UnallocatedCents { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<BudgetSavingsAllocation> Allocations { get; set; } = [];
}

public sealed class BudgetSavingsAllocation
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid ContributionId { get; set; }
    public Guid PurposeId { get; set; }
    public string Mode { get; set; } = BudgetValues.FixedBuffer;
    public long RequestedValue { get; set; }
    public long AmountCents { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetSavingsPurchase
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid PeriodId { get; set; }
    public Guid LedgerEntryId { get; set; }
    public string IdempotencyKey { get; set; } = "";
    public DateOnly OccurredOn { get; set; }
    public string Description { get; set; } = "";
    public long AmountCents { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<BudgetSavingsPurchaseFunding> Funding { get; set; } = [];
}

public sealed class BudgetSavingsPurchaseFunding
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid PurchaseId { get; set; }
    public int Sequence { get; set; }
    public string Source { get; set; } = BudgetValues.Goal;
    public Guid? PurposeId { get; set; }
    public long AmountCents { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetInvestmentEvent
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid PeriodId { get; set; }
    public string? IdempotencyKey { get; set; }
    public string Kind { get; set; } = BudgetValues.Contribution;
    public DateOnly OccurredOn { get; set; }
    public string Description { get; set; } = "";
    public long AmountCents { get; set; }
    public string? Destination { get; set; }
    public Guid? TargetPurposeId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetWishlistItem
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = "";
    public long? EstimatedPriceCents { get; set; }
    public string Priority { get; set; } = BudgetValues.Medium;
    public string Notes { get; set; } = "";
    public string Status { get; set; } = BudgetValues.Active;
    public Guid? SavingsGoalId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class BudgetIncomePlan
{
    public Guid Id { get; set; }
    public Guid SeriesId { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = "";
    public long AmountCents { get; set; }
    public string Cadence { get; set; } = BudgetValues.Monthly;
    public string IntervalUnit { get; set; } = BudgetValues.Month;
    public int IntervalCount { get; set; } = 1;
    public string Weekdays { get; set; } = "";
    public DateOnly StartDate { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string ChangeReason { get; set; } = "";
    public bool AutomaticPosting { get; set; }
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class BudgetIncomePlanPause
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid SeriesId { get; set; }
    public DateOnly From { get; set; }
    public DateOnly Through { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetIncomePlanStop
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid SeriesId { get; set; }
    public DateOnly EffectiveOn { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetIncomeOccurrenceOverride
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid SeriesId { get; set; }
    public DateOnly ScheduledOn { get; set; }
    public DateOnly OccurredOn { get; set; }
    public string Name { get; set; } = "";
    public long AmountCents { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetIncomePosting
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid SeriesId { get; set; }
    public Guid VersionId { get; set; }
    public DateOnly ScheduledOn { get; set; }
    public DateOnly ExpectedOn { get; set; }
    public DateOnly ActualOn { get; set; }
    public long ExpectedAmountCents { get; set; }
    public long ActualAmountCents { get; set; }
    public long VarianceCents { get; set; }
    public string PostingMode { get; set; } = "manual";
    public Guid LedgerEntryId { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<BudgetIncomeVarianceAllocation> Allocations { get; set; } = [];
}

public sealed class BudgetIncomeVarianceRule
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid? SeriesId { get; set; }
    public string Mode { get; set; } = BudgetValues.Fixed;
    public DateTime EffectiveFrom { get; set; }
    public List<BudgetIncomeVarianceRuleRoute> Routes { get; set; } = [];
}

public sealed class BudgetIncomeVarianceRuleRoute
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid RuleId { get; set; }
    public int Position { get; set; }
    public string Destination { get; set; } = BudgetValues.Buffer;
    public Guid? TargetId { get; set; }
    public long Value { get; set; }
}

public sealed class BudgetIncomeVarianceAllocation
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid PostingId { get; set; }
    public string Destination { get; set; } = BudgetValues.Buffer;
    public Guid? TargetId { get; set; }
    public long AmountCents { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetCommitmentPlan
{
    public Guid Id { get; set; }
    public Guid SeriesId { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid? CategoryId { get; set; }
    public string Kind { get; set; } = BudgetValues.FixedCost;
    public string Name { get; set; } = "";
    public long AmountCents { get; set; }
    public string Cadence { get; set; } = BudgetValues.Monthly;
    public string IntervalUnit { get; set; } = BudgetValues.Month;
    public int IntervalCount { get; set; } = 1;
    public string Weekdays { get; set; } = "";
    public DateOnly StartDate { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string BudgetingMode { get; set; } = BudgetValues.DuePeriod;
    public bool ChargeFirstShortfall { get; set; }
    public bool AutomaticPosting { get; set; }
    public string ChangeReason { get; set; } = "";
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class BudgetCommitmentPause
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid SeriesId { get; set; }
    public DateOnly From { get; set; }
    public DateOnly Through { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetCommitmentStop
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid SeriesId { get; set; }
    public DateOnly EffectiveOn { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetCommitmentOccurrenceOverride
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid SeriesId { get; set; }
    public DateOnly ScheduledOn { get; set; }
    public DateOnly OccurredOn { get; set; }
    public string Name { get; set; } = "";
    public long AmountCents { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetCommitmentPosting
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid SeriesId { get; set; }
    public Guid VersionId { get; set; }
    public DateOnly ScheduledOn { get; set; }
    public DateOnly ExpectedOn { get; set; }
    public DateOnly ActualOn { get; set; }
    public long ExpectedAmountCents { get; set; }
    public long ActualAmountCents { get; set; }
    public long ReservationCoverageCents { get; set; }
    public long DirectOrdinaryImpactCents { get; set; }
    public string PostingMode { get; set; } = BudgetValues.Manual;
    public Guid LedgerEntryId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetOpeningAllocation
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Kind { get; set; } = "";
    public string Name { get; set; } = "";
    public long AmountCents { get; set; }
    public DateOnly OccurredOn { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetLedgerEntry
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid PeriodId { get; set; }
    public Guid? CategoryId { get; set; }
    public string Kind { get; set; } = "";
    public DateOnly OccurredOn { get; set; }
    public string Description { get; set; } = "";
    public long AmountCents { get; set; }
    public long OrdinaryImpactCents { get; set; }
    public string Source { get; set; } = "manual";
    public string MerchantRaw { get; set; } = "";
    public string MerchantNormalized { get; set; } = "";
    public string? MerchantBrandKey { get; set; }
    public Guid? SourceRecordId { get; set; }
    public Guid? LegacyTransactionId { get; set; }
    public Guid? CorrectsEntryId { get; set; }
    public Guid? RelatedEntryId { get; set; }
    public string ChangeReason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public List<BudgetLedgerSplit> Splits { get; set; } = [];
}

public sealed class BudgetLedgerAction
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid LedgerEntryId { get; set; }
    public string Kind { get; set; } = "";
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetLedgerSplit
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid LedgerEntryId { get; set; }
    public Guid? CategoryId { get; set; }
    public Guid? CategoryVersionId { get; set; }
    public string CategoryNameSnapshot { get; set; } = "";
    public string CategoryColorSnapshot { get; set; } = "";
    public string CategoryIconSnapshot { get; set; } = "";
    public long AmountCents { get; set; }
    public long OrdinaryImpactCents { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetCategoryVersion
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid CategoryId { get; set; }
    public string Name { get; set; } = "";
    public string Color { get; set; } = "";
    public string Icon { get; set; } = "tag";
    public string Behavior { get; set; } = BudgetValues.IncludeInLimit;
    public bool Archived { get; set; }
    public DateTime EffectiveFrom { get; set; }
}

public sealed class BudgetMigrationIssue
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Code { get; set; } = "";
    public string LegacyRecordType { get; set; } = "";
    public Guid LegacyRecordId { get; set; }
    public string Detail { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class BudgetCategory
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = "";
    public string Color { get; set; } = "";
    public string Icon { get; set; } = "tag";
    public string Behavior { get; set; } = BudgetValues.IncludeInLimit;
    public bool Protected { get; set; }
    public DateTime? ArchivedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class BudgetAccount
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = "";
    public long BalanceCents { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class BudgetTransaction
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid PeriodId { get; set; }
    public Guid AccountId { get; set; }
    public Guid? CategoryId { get; set; }
    public Guid? PlannedExpenseId { get; set; }
    public DateOnly OccurredOn { get; set; }
    public string Description { get; set; } = "";
    public long AmountCents { get; set; }
    public bool IncludeInLimit { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class PlannedExpense
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid AccountId { get; set; }
    public Guid? CategoryId { get; set; }
    public string Name { get; set; } = "";
    public string Kind { get; set; } = BudgetValues.FixedCost;
    public string Cadence { get; set; } = BudgetValues.Monthly;
    public long AmountCents { get; set; }
    public int DueDay { get; set; }
    public int? DueMonth { get; set; }
    public bool IncludeInLimit { get; set; }
    public bool Active { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class PlannedExpenseApplication
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid PlannedExpenseId { get; set; }
    public Guid PeriodId { get; set; }
    public Guid TransactionId { get; set; }
    public DateTime AppliedAt { get; set; }
}

public static class BudgetValues
{
    public const string IncludeInLimit = "include_in_limit";
    public const string ExcludeFromLimit = "exclude_from_limit";
    public const string FixedCost = "fixed_cost";
    public const string Subscription = "subscription";
    public const string Monthly = "monthly";
    public const string Daily = "daily";
    public const string Weekly = "weekly";
    public const string Quarterly = "quarterly";
    public const string Yearly = "yearly";
    public const string Custom = "custom";
    public const string Day = "day";
    public const string Week = "week";
    public const string Month = "month";
    public const string Quarter = "quarter";
    public const string Year = "year";
    public const string Fixed = "fixed";
    public const string Percentage = "percentage";
    public const string Buffer = "buffer";
    public const string Ordinary = "ordinary";
    public const string Savings = "savings";
    public const string Investment = "investment";
    public const string Manual = "manual";
    public const string Automatic = "automatic";
    public const string Matched = "matched";
    public const string DuePeriod = "due_period";
    public const string GradualReservation = "gradual_reservation";
    public const string Retain = "retain";
    public const string Contribution = "contribution";
    public const string Opening = "opening";
    public const string DateDriven = "date";
    public const string RateDriven = "rate";
    public const string Goal = "goal";
    public const string Valuation = "valuation";
    public const string Withdrawal = "withdrawal";
    public const string Low = "low";
    public const string Medium = "medium";
    public const string High = "high";
    public const string Active = "active";
    public const string Completed = "completed";
    public const string Removed = "removed";
    public const string FixedBuffer = "fixed";
    public const string PercentageBuffer = "percentage";
    public const string Income = "income";
    public const string Expense = "expense";
    public const string Refund = "refund";
    public const string Void = "void";
}

public sealed record CategorySummary(Guid Id, string Name, string Color, string Icon, string Behavior, bool Archived, long SpentCents);
public sealed record PlannedExpenseSummary(
    Guid Id, Guid OwnerUserId, Guid AccountId, Guid? CategoryId, string Name, string Kind, string Cadence,
    long AmountCents, int DueDay, int? DueMonth, bool IncludeInLimit, bool Active,
    DateTime CreatedAt, DateTime UpdatedAt, bool AppliedInCurrentPeriod);
public sealed record BudgetSummary(
    BudgetPeriod Period,
    IReadOnlyList<CategorySummary> Categories,
    long SpentInLimitCents,
    long ExcludedSpentCents,
    long RemainingCents,
    long AccountBalanceCents,
    IReadOnlyList<BudgetAccount> Accounts,
    IReadOnlyList<PlannedExpenseSummary> PlannedExpenses,
    long ActualIncomeCents,
    long ForecastBufferTargetCents,
    long ActualBufferTargetCents,
    long FundedBufferCents,
    long BufferShortfallCents,
    long AccumulatedBufferCents,
    long ProtectedBufferCents,
    long DeficitCarryoverCents,
    long SavingsContributionCents,
    long TotalSavingsCents,
    long UnallocatedSavingsCents,
    long InvestmentContributionCents,
    long TotalInvestmentCents,
    long InvestmentContributedCapitalCents,
    long InvestmentGainCents,
    long InvestmentGainBasisPoints,
    long ReservationCents,
    long MaximumOrdinaryCents,
    long OrdinaryAvailableCents,
    IReadOnlyList<BudgetLedgerEntry> LedgerEntries);
