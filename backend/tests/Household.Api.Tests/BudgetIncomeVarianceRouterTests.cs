using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class BudgetIncomeVarianceRouterTests
{
    [Fact]
    public void Fixed_routes_are_capped_and_leave_the_remainder_in_buffer()
    {
        var result = BudgetIncomeVarianceRouter.Route(10_000, BudgetValues.Fixed,
        [
            new IncomeVarianceRouteInput(BudgetValues.Ordinary, 3_000, null),
            new IncomeVarianceRouteInput(BudgetValues.Savings, 4_000, Guid.NewGuid()),
        ]);

        Assert.Equal(3_000, result.Single(x => x.Destination == BudgetValues.Ordinary).AmountCents);
        Assert.Equal(4_000, result.Single(x => x.Destination == BudgetValues.Savings).AmountCents);
        Assert.Equal(3_000, result.Single(x => x.Destination == BudgetValues.Buffer).AmountCents);
    }

    [Fact]
    public void Percentage_routes_use_minor_unit_flooring_and_keep_rounding_remainder_safe()
    {
        var result = BudgetIncomeVarianceRouter.Route(10_001, BudgetValues.Percentage,
        [
            new IncomeVarianceRouteInput(BudgetValues.Ordinary, 3_333, null),
            new IncomeVarianceRouteInput(BudgetValues.Investment, 3_333, Guid.NewGuid()),
        ]);

        Assert.Equal(3_333, result.Single(x => x.Destination == BudgetValues.Ordinary).AmountCents);
        Assert.Equal(3_333, result.Single(x => x.Destination == BudgetValues.Investment).AmountCents);
        Assert.Equal(3_335, result.Single(x => x.Destination == BudgetValues.Buffer).AmountCents);
        Assert.Equal(10_001, result.Sum(x => x.AmountCents));
    }

    [Fact]
    public void Missing_rules_route_everything_to_unallocated_buffer()
    {
        var result = BudgetIncomeVarianceRouter.Route(5_000, BudgetValues.Fixed, []);

        var allocation = Assert.Single(result);
        Assert.Equal(BudgetValues.Buffer, allocation.Destination);
        Assert.Equal(5_000, allocation.AmountCents);
    }

    [Fact]
    public void Invalid_percentage_totals_and_destinations_are_rejected()
    {
        Assert.Throws<ArgumentException>(() => BudgetIncomeVarianceRouter.Route(10_000, BudgetValues.Percentage,
        [
            new IncomeVarianceRouteInput(BudgetValues.Ordinary, 7_000, null),
            new IncomeVarianceRouteInput(BudgetValues.Buffer, 4_000, null),
        ]));
        Assert.Throws<ArgumentException>(() => BudgetIncomeVarianceRouter.Route(10_000, BudgetValues.Fixed,
            [new IncomeVarianceRouteInput("unknown", 100, null)]));
    }
}
