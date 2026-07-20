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
    public DateTime? SetupCompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class BudgetIncomePlan
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = "";
    public long AmountCents { get; set; }
    public string Cadence { get; set; } = BudgetValues.Monthly;
    public DateOnly StartDate { get; set; }
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
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

public sealed class BudgetCategory
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = "";
    public string Color { get; set; } = "";
    public string Behavior { get; set; } = BudgetValues.IncludeInLimit;
    public bool Protected { get; set; }
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
    public const string Yearly = "yearly";
    public const string FixedBuffer = "fixed";
    public const string PercentageBuffer = "percentage";
}

public sealed record CategorySummary(Guid Id, string Name, string Color, string Behavior, long SpentCents);
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
    IReadOnlyList<PlannedExpenseSummary> PlannedExpenses);
