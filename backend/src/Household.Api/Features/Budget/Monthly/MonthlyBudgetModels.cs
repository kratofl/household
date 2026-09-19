namespace Household.Api.Features.Budget;

public sealed record MonthlyCost(Guid Id, string Name, long AmountCents, string Kind, int? DueMonth, int? DueDay);
public sealed record MonthlyReserve(Guid CategoryId, long AmountCents);
public sealed record MonthlyPlan(long IncomeCents, long BufferCents, long SavingsCents,
    IReadOnlyList<MonthlyCost> Costs, IReadOnlyList<MonthlyReserve> Reserves);
public sealed record MonthlyFunding(string Source, Guid? CategoryId, long AmountCents);
public sealed record MonthlyPlanVersion(long Revision, DateOnly EffectiveFrom, MonthlyPlan Plan);
// CategoryName is frozen at posting because the category drives budget behaviour and past
// reports must not move. The merchant is a label, so only its id is kept and a rename shows
// through everywhere.
public sealed record MonthlyExpense(Guid Id, DateOnly OccurredOn, string Description, Guid CategoryId,
    string CategoryName, long AmountCents, IReadOnlyList<MonthlyFunding> Funding, string Kind, Guid? RelatedId)
{
    public Guid? MerchantId { get; init; }
}
public sealed record MonthlyAllowance(Guid CategoryId, long ReservedCents, long RemainingCents);
public sealed record MonthlyCostDue(Guid Id, string Name, string Kind, long AmountCents);
public sealed record MonthlyPeriodSummary(DateOnly Start, DateOnly End, long IncomeCents,
    long StartingFunCents, long FunRemainingCents, long SavingsBalanceCents, long BufferBalanceCents,
    long SavingsContributionCents, long DeficitCarryoverCents, long FundingShortfallCents,
    IReadOnlyList<MonthlyAllowance> Categories, IReadOnlyList<MonthlyCostDue> Costs);

// Plan versions and expense actions are immutable rows. JSON holds validated value records.
public sealed record MonthlyPlanRow
{
    public Guid Id { get; init; }
    public Guid OwnerUserId { get; init; }
    public long Revision { get; init; }
    public DateOnly EffectiveFrom { get; init; }
    public int StartDay { get; init; }
    public string Currency { get; init; } = "EUR";
    public string TimeZoneId { get; init; } = "Europe/Berlin";
    public long OpeningSavingsCents { get; init; }
    public string PlanJson { get; init; } = "";
}

public sealed record MonthlyCategoryRow
{
    public Guid Id { get; init; }
    public Guid OwnerUserId { get; init; }
    public string Name { get; set; } = "";
    public bool Archived { get; set; }
}

public sealed record MonthlyEntryRow
{
    public long Sequence { get; init; }
    public Guid Id { get; init; }
    public Guid OwnerUserId { get; init; }
    public string RequestKey { get; init; } = "";
    public string RequestJson { get; init; } = "";
    public DateOnly OccurredOn { get; init; }
    public string Kind { get; init; } = "expense";
    public Guid? RelatedId { get; init; }
    public string ExpenseJson { get; init; } = "";
    public DateTime CreatedAt { get; init; }
}
