namespace Household.Api.Features.Budget;

public enum RecurrenceUnit
{
    Day,
    Week,
    Month,
    Quarter,
    Year,
}

public sealed record RecurrenceSchedule(
    DateOnly AnchorDate,
    RecurrenceUnit Unit,
    int Interval,
    IReadOnlyCollection<DayOfWeek> Weekdays);

public static class BudgetRecurrence
{
    public static IReadOnlyList<DateOnly> Between(RecurrenceSchedule schedule, DateOnly from, DateOnly through)
    {
        if (schedule.Interval <= 0) throw new ArgumentOutOfRangeException(nameof(schedule), "Interval must be positive");
        if (schedule.Unit != RecurrenceUnit.Week && schedule.Weekdays.Count > 0)
            throw new ArgumentException("Weekdays are only valid for weekly recurrences", nameof(schedule));
        if (through < from) return [];

        DateOnly first = from > schedule.AnchorDate ? from : schedule.AnchorDate;
        List<DateOnly> result = new List<DateOnly>();
        for (DateOnly date = first; date <= through; date = date.AddDays(1))
        {
            if (OccursOn(schedule, date)) result.Add(date);
        }
        return result;
    }

    private static bool OccursOn(RecurrenceSchedule schedule, DateOnly date) => schedule.Unit switch
    {
        RecurrenceUnit.Day => (date.DayNumber - schedule.AnchorDate.DayNumber) % schedule.Interval == 0,
        RecurrenceUnit.Week => IsWeeklyOccurrence(schedule, date),
        RecurrenceUnit.Month => IsMonthlyOccurrence(schedule, date, schedule.Interval),
        RecurrenceUnit.Quarter => IsMonthlyOccurrence(schedule, date, checked(schedule.Interval * 3)),
        RecurrenceUnit.Year => IsYearlyOccurrence(schedule, date),
        _ => false,
    };

    private static bool IsWeeklyOccurrence(RecurrenceSchedule schedule, DateOnly date)
    {
        int activeWeek = (date.DayNumber - schedule.AnchorDate.DayNumber) / 7;
        bool selectedDay = schedule.Weekdays.Count == 0
            ? date.DayOfWeek == schedule.AnchorDate.DayOfWeek
            : schedule.Weekdays.Contains(date.DayOfWeek);
        return activeWeek % schedule.Interval == 0 && selectedDay;
    }

    private static bool IsMonthlyOccurrence(RecurrenceSchedule schedule, DateOnly date, int intervalMonths)
    {
        int monthDifference = checked((date.Year - schedule.AnchorDate.Year) * 12 + date.Month - schedule.AnchorDate.Month);
        return monthDifference >= 0 && monthDifference % intervalMonths == 0 &&
               date.Day == Math.Min(schedule.AnchorDate.Day, DateTime.DaysInMonth(date.Year, date.Month));
    }

    private static bool IsYearlyOccurrence(RecurrenceSchedule schedule, DateOnly date)
    {
        int yearDifference = date.Year - schedule.AnchorDate.Year;
        return yearDifference >= 0 && yearDifference % schedule.Interval == 0 &&
               date.Month == schedule.AnchorDate.Month &&
               date.Day == Math.Min(schedule.AnchorDate.Day, DateTime.DaysInMonth(date.Year, date.Month));
    }
}
