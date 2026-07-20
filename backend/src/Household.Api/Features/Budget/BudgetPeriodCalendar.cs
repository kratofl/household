namespace Household.Api.Features.Budget;

public readonly record struct BudgetPeriodRange(DateOnly Start, DateOnly End, int PreferredStartDay);

public static class BudgetPeriodCalendar
{
    public static BudgetPeriodRange ForDate(DateOnly date, int preferredStartDay)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(preferredStartDay, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(preferredStartDay, 31);

        var thisMonthBoundary = Boundary(date.Year, date.Month, preferredStartDay);
        var start = date >= thisMonthBoundary
            ? thisMonthBoundary
            : Boundary(date.AddMonths(-1).Year, date.AddMonths(-1).Month, preferredStartDay);
        var nextMonth = start.AddMonths(1);
        var nextBoundary = Boundary(nextMonth.Year, nextMonth.Month, preferredStartDay);
        return new BudgetPeriodRange(start, nextBoundary.AddDays(-1), preferredStartDay);
    }

    private static DateOnly Boundary(int year, int month, int preferredStartDay) =>
        new(year, month, Math.Min(preferredStartDay, DateTime.DaysInMonth(year, month)));
}
