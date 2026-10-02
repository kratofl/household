namespace Household.Api.Features.Budget;

public static class MonthlyBudgetValidation
{
    public const long MaximumCents = 10_000_000_000;
    public static bool Money(long amount) => amount >= 0 && amount <= MaximumCents;
    public static bool Name(string? name) => !string.IsNullOrWhiteSpace(name) && name.Trim().Length <= 100;

    public static bool Plan(MonthlyPlan? plan, IReadOnlyList<MonthlyCategoryRow> categories)
    {
        if (plan is null || !Money(plan.IncomeCents) || !Money(plan.BufferCents) || !Money(plan.SavingsCents) ||
            plan.Costs is null || plan.Reserves is null || plan.Costs.Count > 100 || plan.Reserves.Count > 100)
            return false;
        HashSet<Guid> categoryIds = categories.Where(category => !category.Archived).Select(category => category.Id).ToHashSet();
        return plan.Costs.All(cost => cost is not null && cost.Id != Guid.Empty && Name(cost.Name) && Money(cost.AmountCents) &&
                (cost.Kind is "fixed" or "monthly" ? cost.DueMonth is null && cost.DueDay is null :
                 cost.Kind == "yearly" && cost.DueMonth is >= 1 and <= 12 && cost.DueDay is >= 1 and <= 31)) &&
            plan.Costs.Select(cost => cost.Id).Distinct().Count() == plan.Costs.Count &&
            plan.Reserves.All(reserve => reserve is not null && categoryIds.Contains(reserve.CategoryId) && Money(reserve.AmountCents)) &&
            plan.Reserves.Select(reserve => reserve.CategoryId).Distinct().Count() == plan.Reserves.Count;
    }

    public static bool Funding(IReadOnlyList<MonthlyFunding>? funding, long amount, Guid categoryId) =>
        funding is not null && funding.Count is > 0 and <= 4 &&
        funding.All(part => part is not null && part.AmountCents > 0 && Money(part.AmountCents) &&
            (part.Source == "category" ? part.CategoryId == categoryId :
                part.Source is "fun" or "savings" or "buffer" && part.CategoryId is null)) &&
        funding.Select(part => part.Source).Distinct().Count() == funding.Count &&
        funding.Sum(part => part.AmountCents) == amount;
}
