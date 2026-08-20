using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class BudgetRecurrenceTests
{
    [Fact]
    public void Monthly_occurrences_clamp_short_months_without_drifting_the_anchor_day()
    {
        var schedule = new RecurrenceSchedule(new DateOnly(2026, 1, 31), RecurrenceUnit.Month, 1, []);

        var occurrences = BudgetRecurrence.Between(schedule, new DateOnly(2026, 1, 1), new DateOnly(2026, 4, 30));

        Assert.Equal(
            [new DateOnly(2026, 1, 31), new DateOnly(2026, 2, 28), new DateOnly(2026, 3, 31), new DateOnly(2026, 4, 30)],
            occurrences);
    }

    [Fact]
    public void Every_n_weeks_supports_multiple_weekdays_in_anchored_weeks()
    {
        var schedule = new RecurrenceSchedule(
            new DateOnly(2026, 7, 6), RecurrenceUnit.Week, 2, [DayOfWeek.Monday, DayOfWeek.Thursday]);

        var occurrences = BudgetRecurrence.Between(schedule, new DateOnly(2026, 7, 1), new DateOnly(2026, 8, 3));

        Assert.Equal(
            [
                new DateOnly(2026, 7, 6), new DateOnly(2026, 7, 9),
                new DateOnly(2026, 7, 20), new DateOnly(2026, 7, 23),
                new DateOnly(2026, 8, 3),
            ],
            occurrences);
    }

    [Theory]
    [InlineData(RecurrenceUnit.Day, 3, "2026-07-01", "2026-07-10", "2026-07-01,2026-07-04,2026-07-07,2026-07-10")]
    [InlineData(RecurrenceUnit.Quarter, 2, "2026-01-31", "2027-01-31", "2026-01-31,2026-07-31,2027-01-31")]
    [InlineData(RecurrenceUnit.Year, 1, "2024-02-29", "2028-02-29", "2024-02-29,2025-02-28,2026-02-28,2027-02-28,2028-02-29")]
    public void Every_n_calendar_units_remain_anchored(
        RecurrenceUnit unit, int interval, string start, string end, string expected)
    {
        var schedule = new RecurrenceSchedule(DateOnly.Parse(start), unit, interval, []);

        var occurrences = BudgetRecurrence.Between(schedule, DateOnly.Parse(start), DateOnly.Parse(end));

        Assert.Equal(expected.Split(',').Select(DateOnly.Parse), occurrences);
    }

    [Fact]
    public void Invalid_intervals_and_weekdays_are_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            BudgetRecurrence.Between(new RecurrenceSchedule(new DateOnly(2026, 1, 1), RecurrenceUnit.Day, 0, []),
                new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 2)));
        Assert.Throws<ArgumentException>(() =>
            BudgetRecurrence.Between(new RecurrenceSchedule(new DateOnly(2026, 1, 1), RecurrenceUnit.Month, 1, [DayOfWeek.Monday]),
                new DateOnly(2026, 1, 1), new DateOnly(2026, 2, 1)));
    }
}
