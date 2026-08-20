namespace Household.Api.Features.Budget;

public sealed record IncomeVarianceRouteInput(string Destination, long Value, Guid? TargetId);
public sealed record IncomeVarianceAllocationResult(string Destination, Guid? TargetId, long AmountCents);

public static class BudgetIncomeVarianceRouter
{
    private static readonly HashSet<string> Destinations =
        [BudgetValues.Buffer, BudgetValues.Ordinary, BudgetValues.Savings, BudgetValues.Investment];

    public static IReadOnlyList<IncomeVarianceAllocationResult> Route(
        long positiveVarianceCents,
        string mode,
        IReadOnlyList<IncomeVarianceRouteInput> routes)
    {
        if (positiveVarianceCents < 0) throw new ArgumentOutOfRangeException(nameof(positiveVarianceCents));
        if (mode is not (BudgetValues.Fixed or BudgetValues.Percentage))
            throw new ArgumentException("Routing mode must be fixed or percentage", nameof(mode));
        if (routes.Any(x => !Destinations.Contains(x.Destination) || x.Value < 0))
            throw new ArgumentException("Variance route is invalid", nameof(routes));
        if (routes.Any(x => x.Destination is BudgetValues.Savings or BudgetValues.Investment && !x.TargetId.HasValue))
            throw new ArgumentException("Savings and investment routes require a target", nameof(routes));
        if (mode == BudgetValues.Percentage && routes.Sum(x => x.Value) > 10_000)
            throw new ArgumentException("Percentage routes cannot exceed 100 percent", nameof(routes));
        if (positiveVarianceCents == 0) return [];

        var remaining = positiveVarianceCents;
        var allocations = new List<IncomeVarianceAllocationResult>();
        foreach (var route in routes)
        {
            var requested = mode == BudgetValues.Percentage
                ? checked(positiveVarianceCents * route.Value / 10_000)
                : route.Value;
            var amount = Math.Min(remaining, requested);
            if (amount <= 0) continue;
            allocations.Add(new IncomeVarianceAllocationResult(route.Destination, route.TargetId, amount));
            remaining -= amount;
            if (remaining == 0) break;
        }
        if (remaining > 0) allocations.Add(new IncomeVarianceAllocationResult(BudgetValues.Buffer, null, remaining));
        return allocations
            .GroupBy(x => (x.Destination, x.TargetId))
            .Select(x => new IncomeVarianceAllocationResult(x.Key.Destination, x.Key.TargetId, x.Sum(y => y.AmountCents)))
            .ToList();
    }
}
