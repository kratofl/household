using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class BudgetPeriodCalendarTests
{
    [Theory]
    [InlineData("2026-02-27", 31, "2026-01-31", "2026-02-27")]
    [InlineData("2026-02-28", 31, "2026-02-28", "2026-03-30")]
    [InlineData("2026-03-31", 31, "2026-03-31", "2026-04-29")]
    [InlineData("2028-02-29", 31, "2028-02-29", "2028-03-30")]
    [InlineData("2026-07-20", 1, "2026-07-01", "2026-07-31")]
    public void Selected_period_clamps_each_boundary_without_changing_the_preferred_day(
        string selectedDate,
        int preferredStartDay,
        string expectedStart,
        string expectedEnd)
    {
        var period = BudgetPeriodCalendar.ForDate(DateOnly.Parse(selectedDate), preferredStartDay);

        Assert.Equal(DateOnly.Parse(expectedStart), period.Start);
        Assert.Equal(DateOnly.Parse(expectedEnd), period.End);
        Assert.Equal(preferredStartDay, period.PreferredStartDay);
    }

    [Fact]
    public void Invalid_preferred_days_are_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => BudgetPeriodCalendar.ForDate(new DateOnly(2026, 7, 20), 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => BudgetPeriodCalendar.ForDate(new DateOnly(2026, 7, 20), 32));
    }
}
