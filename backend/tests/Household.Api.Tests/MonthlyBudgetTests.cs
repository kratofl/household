using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class MonthlyBudgetTests
{
    private static readonly Guid Fuel = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private static MonthlyPlan SpreadsheetPlan() => new(255173, 20000, 100000,
        [new(Guid.NewGuid(), "Papa", 50000, "fixed", null, null),
         new(Guid.NewGuid(), "Monthly subscriptions", 6596, "monthly", null, null),
         new(Guid.NewGuid(), "Credit card", 3600, "yearly", 9, 1),
         new(Guid.NewGuid(), "Amazon", 8990, "yearly", 10, 25)], [new(Fuel, 18000)]);

    [Theory]
    [InlineData(7, 60577)]
    [InlineData(9, 56977)]
    [InlineData(10, 51587)]
    public void Spreadsheet_allowance_charges_yearly_bills_only_when_due(int month, long expected)
    {
        MonthlyPeriodSummary result = MonthlyBudgetCalculator.Project(
            [new(1, new DateOnly(2026, month, 1), SpreadsheetPlan())], [],
            new DateOnly(2026, month, 15), 1, 0);
        Assert.Equal(expected, result.StartingFunCents);
        Assert.Equal(expected, result.FunRemainingCents);
    }

    [Fact]
    public void Fuel_and_savings_purchases_leave_fun_money_untouched_and_refunds_restore_the_source()
    {
        DateOnly date = new(2026, 7, 15);
        MonthlyExpense fuel = new(Guid.NewGuid(), date, "Aral", Fuel, "Tanken", 12162,
            [new("category", Fuel, 12162)], "expense", null);
        MonthlyExpense purchase = new(Guid.NewGuid(), date, "Laptop", Fuel, "Technik", 25000,
            [new("savings", null, 25000)], "expense", null);
        MonthlyExpense refund = new(Guid.NewGuid(), date, "Refund", Fuel, "Technik", 5000,
            [new("savings", null, 5000)], "refund", purchase.Id);
        MonthlyPeriodSummary result = MonthlyBudgetCalculator.Project(
            [new(1, new DateOnly(2026, 7, 1), SpreadsheetPlan())], [fuel, purchase, refund], date, 1, 0);
        Assert.Equal(60577, result.FunRemainingCents);
        Assert.Equal(5838, Assert.Single(result.Categories).RemainingCents);
        Assert.Equal(80000, result.SavingsBalanceCents);
    }

    [Fact]
    public void Reopening_after_missed_periods_accumulates_savings_once_and_uses_future_plan_only_when_effective()
    {
        MonthlyPlan original = new(100000, 10000, 20000, [], [new(Fuel, 10000)]);
        MonthlyPlan changed = original with { SavingsCents = 30000 };
        MonthlyPlanVersion[] plans = [new(1, new(2026, 7, 1), original), new(2, new(2026, 8, 1), changed)];
        MonthlyPeriodSummary july = MonthlyBudgetCalculator.Project(plans, [], new(2026, 7, 31), 1, 50000);
        MonthlyPeriodSummary september = MonthlyBudgetCalculator.Project(plans, [], new(2026, 9, 5), 1, 50000);
        Assert.Equal(70000, july.SavingsBalanceCents);
        Assert.Equal(60000, july.FunRemainingCents);
        Assert.Equal(260000, september.SavingsBalanceCents);
        Assert.Equal(30000, september.BufferBalanceCents);
        Assert.Equal(50000, september.FunRemainingCents);
        Assert.Equal(september.SavingsBalanceCents,
            MonthlyBudgetCalculator.Project(plans, [], new(2026, 9, 5), 1, 50000).SavingsBalanceCents);
    }

    [Fact]
    public void Leftover_category_money_offsets_deficit_before_carryover_without_using_buffer()
    {
        MonthlyPlan plan = new(100000, 10000, 20000, [], [new(Fuel, 10000)]);
        MonthlyExpense expense = new(Guid.NewGuid(), new(2026, 7, 15), "Purchase", Fuel, "Other", 75000,
            [new("fun", null, 75000)], "expense", null);
        MonthlyPeriodSummary august = MonthlyBudgetCalculator.Project([new(1, new(2026, 7, 1), plan)],
            [expense], new(2026, 8, 1), 1, 0);
        Assert.Equal(5000, august.DeficitCarryoverCents);
        Assert.Equal(55000, august.FunRemainingCents);
        Assert.Equal(40000, august.SavingsBalanceCents);
        Assert.Equal(20000, august.BufferBalanceCents);
    }

    [Fact]
    public void Protected_balances_cannot_be_overdrawn_even_by_backdated_spending()
    {
        MonthlyExpense expense = new(Guid.NewGuid(), new(2026, 7, 15), "Fuel", Fuel, "Tanken", 18001,
            [new("category", Fuel, 18001)], "expense", null);
        Assert.Throws<MonthlyBudgetConflict>(() => MonthlyBudgetCalculator.Project(
            [new(1, new(2026, 7, 1), SpreadsheetPlan())], [expense], new(2026, 9, 15), 1, 0));
    }

    [Fact]
    public void An_explicit_split_only_charges_the_accepted_remainder_to_fun_money()
    {
        MonthlyExpense expense = new(Guid.NewGuid(), new(2026, 7, 15), "Fuel", Fuel, "Tanken", 20000,
            [new("category", Fuel, 18000), new("fun", null, 2000)], "expense", null);
        MonthlyPeriodSummary result = MonthlyBudgetCalculator.Project([new(1, new(2026, 7, 1), SpreadsheetPlan())],
            [expense], new(2026, 7, 15), 1, 0);
        Assert.Equal(58577, result.FunRemainingCents);
        Assert.Equal(0, Assert.Single(result.Categories).RemainingCents);
    }

    [Fact]
    public void Yearly_due_dates_clamp_and_use_the_custom_budget_period()
    {
        MonthlyPlan plan = new(10000, 0, 0, [new(Guid.NewGuid(), "Annual", 1000, "yearly", 2, 31)], []);
        MonthlyPeriodSummary february = MonthlyBudgetCalculator.Project([new(1, new(2026, 2, 25), plan)],
            [], new(2026, 3, 5), 25, 0);
        Assert.Equal(9000, february.StartingFunCents);
        Assert.Single(february.Costs);
    }

    [Fact]
    public void Refund_to_a_category_without_a_current_reserve_returns_to_savings()
    {
        MonthlyPlan first = new(10000, 0, 0, [], [new(Fuel, 1000)]);
        MonthlyPlan next = first with { Reserves = [] };
        MonthlyExpense expense = new(Guid.NewGuid(), new(2026, 7, 15), "Fuel", Fuel, "Tanken", 1000,
            [new("category", Fuel, 1000)], "expense", null);
        MonthlyExpense refund = expense with { Id = Guid.NewGuid(), OccurredOn = new(2026, 8, 5), Kind = "refund", RelatedId = expense.Id };
        MonthlyPeriodSummary result = MonthlyBudgetCalculator.Project([new(1, new(2026, 7, 1), first), new(2, new(2026, 8, 1), next)],
            [expense, refund], new(2026, 8, 5), 1, 0);
        Assert.Equal(10000, result.FunRemainingCents);
        Assert.Equal(10000, result.SavingsBalanceCents);
    }

    [Fact]
    public void An_unaffordable_period_keeps_the_category_source_visible_without_inventing_reserved_money()
    {
        MonthlyPlan plan = new(10000, 1000, 2000, [], [new(Fuel, 1000)]);
        MonthlyExpense overspend = new(Guid.NewGuid(), new(2026, 7, 15), "Purchase", Fuel, "Other", 15000,
            [new("fun", null, 15000)], "expense", null);
        MonthlyPeriodSummary result = MonthlyBudgetCalculator.Project([new(1, new(2026, 7, 1), plan)],
            [overspend], new(2026, 8, 1), 1, 0);
        Assert.Equal(2000, result.FundingShortfallCents);
        Assert.Equal(0, result.SavingsContributionCents);
        Assert.Equal(2000, result.SavingsBalanceCents);
        Assert.Equal(1000, result.BufferBalanceCents);
        Assert.Equal(0, Assert.Single(result.Categories).ReservedCents);
    }
}
