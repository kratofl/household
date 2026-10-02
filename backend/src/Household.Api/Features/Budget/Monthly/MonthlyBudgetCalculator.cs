namespace Household.Api.Features.Budget;

public static class MonthlyBudgetCalculator
{
    public static IReadOnlyList<MonthlyCostDue> CostsDue(MonthlyPlan plan, BudgetPeriodRange period) =>
        plan.Costs.Where(cost => cost.Kind != "yearly" || Enumerable.Range(period.Start.Year,
                period.End.Year - period.Start.Year + 1).Any(year =>
                {
                    int month = cost.DueMonth ?? throw new InvalidOperationException("Missing due month.");
                    int day = cost.DueDay ?? throw new InvalidOperationException("Missing due day.");
                    DateOnly due = new(year, month, Math.Min(day, DateTime.DaysInMonth(year, month)));
                    return due >= period.Start && due <= period.End;
                }))
            .Select(cost => new MonthlyCostDue(cost.Id, cost.Name, cost.Kind, cost.AmountCents)).ToArray();

    // Replay each period once. Reads have no posting side effects and work after missed months.
    public static MonthlyPeriodSummary Project(IReadOnlyList<MonthlyPlanVersion> versions,
        IReadOnlyList<MonthlyExpense> entries, DateOnly asOf, int startDay, long openingSavingsCents)
    {
        DateOnly first = versions.Min(version => version.EffectiveFrom);
        if (asOf < first) throw new ArgumentOutOfRangeException(nameof(asOf));
        long savings = openingSavingsCents;
        long buffer = 0;
        long carryover = 0;
        BudgetPeriodRange period = BudgetPeriodCalendar.ForDate(first, startDay);
        while (true)
        {
            MonthlyPlan plan = versions.Where(version => version.EffectiveFrom <= period.Start)
                .OrderBy(version => version.EffectiveFrom).ThenBy(version => version.Revision).Last().Plan;
            IReadOnlyList<MonthlyCostDue> costs = CostsDue(plan, period);
            long capacity = plan.IncomeCents - costs.Sum(cost => cost.AmountCents) - carryover;
            long startingFun = capacity - plan.BufferCents - plan.SavingsCents - plan.Reserves.Sum(reserve => reserve.AmountCents);
            long shortfall = Math.Max(0, -startingFun);
            // An unaffordable period retains its deficit but never invents protected money.
            bool funded = shortfall == 0;
            Dictionary<Guid, long> reserved = plan.Reserves.Where(reserve => reserve.AmountCents > 0).ToDictionary(reserve => reserve.CategoryId,
                reserve => funded ? reserve.AmountCents : 0L);
            Dictionary<Guid, long> remaining = new(reserved);
            long contribution = funded ? plan.SavingsCents : 0;
            savings = checked(savings + contribution);
            buffer = checked(buffer + (funded ? plan.BufferCents : 0));
            long fun = funded ? startingFun : capacity;
            foreach (MonthlyExpense expense in entries.Where(entry => entry.OccurredOn >= period.Start &&
                         entry.OccurredOn <= period.End && entry.OccurredOn <= asOf)
                         .OrderBy(entry => entry.OccurredOn))
            {
                foreach (MonthlyFunding funding in expense.Funding)
                {
                    long delta = expense.Kind == "refund" ? funding.AmountCents : -funding.AmountCents;
                    switch (funding.Source)
                    {
                        case "fun": fun = checked(fun + delta); break;
                        case "savings": savings = checked(savings + delta); break;
                        case "buffer": buffer = checked(buffer + delta); break;
                        case "category" when funding.CategoryId is Guid category:
                            if (remaining.ContainsKey(category) && reserved[category] > 0)
                                remaining[category] = checked(remaining[category] + delta);
                            else if (delta > 0) savings = checked(savings + delta);
                            else throw new MonthlyBudgetConflict("category_unfunded");
                            break;
                        default: throw new InvalidOperationException("Unknown funding source.");
                    }
                }
                if (savings < 0 || buffer < 0 || remaining.Values.Any(amount => amount < 0))
                    throw new MonthlyBudgetConflict("insufficient_funds");
            }
            if (asOf <= period.End)
                return new MonthlyPeriodSummary(period.Start, period.End, plan.IncomeCents,
                    funded ? startingFun : capacity, fun, savings, buffer, contribution, carryover, shortfall,
                    reserved.Select(pair => new MonthlyAllowance(pair.Key, pair.Value, remaining[pair.Key])).ToArray(), costs);

            long leftover = checked(fun + remaining.Values.Sum());
            savings = checked(savings + Math.Max(0, leftover));
            carryover = Math.Max(0, -leftover);
            period = BudgetPeriodCalendar.ForDate(period.End.AddDays(1), startDay);
        }
    }
}

public sealed class MonthlyBudgetConflict(string code) : Exception(code);
