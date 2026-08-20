using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class BudgetCommitmentReservationTests
{
    [Fact]
    public void Reservation_allocation_is_exact_and_does_not_drift()
    {
        var plan = Plan(100, BudgetValues.Quarter, 1, new DateOnly(2026, 1, 1));

        var schedule = BudgetCommitmentReservations.Build(plan, new DateOnly(2026, 4, 15), 1);

        Assert.Equal([34, 33, 33], schedule.Periods.Select(x => x.AmountCents));
        Assert.Equal(100, schedule.Periods.Sum(x => x.AmountCents));
        Assert.Equal(100, schedule.CoverageCents);
        Assert.Equal(0, schedule.ShortfallCents);
    }

    [Fact]
    public void Late_first_cycle_keeps_the_normal_rate_and_exposes_the_shortfall()
    {
        var plan = Plan(120_000, BudgetValues.Year, 1, new DateOnly(2026, 7, 23));

        var schedule = BudgetCommitmentReservations.Build(plan, new DateOnly(2026, 8, 23), 1);

        Assert.Equal(10_000, schedule.RateCents);
        Assert.Equal(10_000, schedule.CoverageCents);
        Assert.Equal(110_000, schedule.ShortfallCents);
        Assert.Single(schedule.Periods, x => x.Eligible);
    }

    private static BudgetCommitmentPlan Plan(long amount, string unit, int interval, DateOnly createdOn) => new()
    {
        AmountCents = amount,
        IntervalUnit = unit,
        IntervalCount = interval,
        BudgetingMode = BudgetValues.GradualReservation,
        EffectiveFrom = createdOn,
        CreatedAt = createdOn.ToDateTime(TimeOnly.MinValue),
    };
}
