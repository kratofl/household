using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class BudgetSavingsGoalPlannerTests
{
    [Fact]
    public void Date_driven_goal_rounds_up_and_replans_after_a_shortfall()
    {
        var initial = BudgetSavingsGoalPlanner.DateDriven(
            100_00, 0, 0, new DateOnly(2026, 7, 23), new DateOnly(2026, 10, 31),
            new DateOnly(2026, 7, 23), 1);
        var behind = BudgetSavingsGoalPlanner.DateDriven(
            100_00, 0, 10_00, new DateOnly(2026, 7, 23), new DateOnly(2026, 10, 31),
            new DateOnly(2026, 8, 23), 1);

        Assert.Equal(25_00, initial.PlannedContributionCents);
        Assert.False(initial.BehindPlan);
        Assert.True(behind.BehindPlan);
        Assert.Equal(30_00, behind.RevisedContributionCents);
        Assert.Equal(new DateOnly(2026, 10, 31), behind.RevisedFundingDate);
    }

    [Fact]
    public void Rate_driven_goal_moves_forecast_when_progress_is_missed()
    {
        var initial = BudgetSavingsGoalPlanner.RateDriven(
            100_00, 0, 25_00, new DateOnly(2026, 7, 23), new DateOnly(2026, 7, 23), 1);
        var behind = BudgetSavingsGoalPlanner.RateDriven(
            100_00, 10_00, 25_00, new DateOnly(2026, 7, 23), new DateOnly(2026, 8, 23), 1,
            initial.PlannedFundingDate);

        Assert.Equal(new DateOnly(2026, 10, 31), initial.PlannedFundingDate);
        Assert.Equal(new DateOnly(2026, 11, 30), behind.RevisedFundingDate);
        Assert.True(behind.BehindPlan);
    }

    [Fact]
    public void Fully_funded_goal_pauses_the_recurring_plan_without_completing_it()
    {
        var result = BudgetSavingsGoalPlanner.RateDriven(
            100_00, 100_00, 25_00, new DateOnly(2026, 7, 23), new DateOnly(2026, 8, 23), 1,
            new DateOnly(2026, 10, 31));

        Assert.True(result.FullyFunded);
        Assert.Equal(new DateOnly(2026, 8, 23), result.RevisedFundingDate);
    }
}
