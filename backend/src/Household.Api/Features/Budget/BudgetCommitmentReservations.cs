namespace Household.Api.Features.Budget;

public static class BudgetCommitmentReservations
{
    public static CommitmentReservationSchedule Build(
        BudgetCommitmentPlan version,
        DateOnly scheduledOn,
        int preferredPeriodStartDay)
    {
        if (version.BudgetingMode != BudgetValues.GradualReservation)
            return new CommitmentReservationSchedule(0, 0, version.AmountCents, []);

        var periodCount = CyclePeriodCount(version.IntervalUnit, version.IntervalCount);
        var duePeriod = BudgetPeriodCalendar.ForDate(scheduledOn, preferredPeriodStartDay);
        var periods = new List<BudgetPeriodRange>(periodCount);
        var cursor = BudgetPeriodCalendar.ForDate(duePeriod.Start.AddDays(-1), preferredPeriodStartDay);
        for (var index = 0; index < periodCount; index++)
        {
            periods.Add(cursor);
            cursor = BudgetPeriodCalendar.ForDate(cursor.Start.AddDays(-1), preferredPeriodStartDay);
        }
        periods.Reverse();

        var createdOn = version.CreatedAt == default
            ? version.EffectiveFrom
            : DateOnly.FromDateTime(version.CreatedAt);
        var reservationBeginsOn = string.IsNullOrEmpty(version.ChangeReason)
            ? createdOn
            : new[] { createdOn, version.EffectiveFrom }.Max();
        var baseAmount = version.AmountCents / periodCount;
        var remainder = version.AmountCents % periodCount;
        var entries = periods.Select((period, index) => new CommitmentReservationPeriod(
                period.Start,
                period.End,
                baseAmount + (index < remainder ? 1 : 0),
                period.End >= reservationBeginsOn))
            .ToList();
        var coverage = entries.Where(x => x.Eligible).Sum(x => x.AmountCents);
        return new CommitmentReservationSchedule(
            baseAmount,
            coverage,
            Math.Max(0, version.AmountCents - coverage),
            entries);
    }

    private static int CyclePeriodCount(string unit, int intervalCount) => unit switch
    {
        BudgetValues.Week => Math.Max(1, (int)Math.Ceiling(intervalCount * 7m / 30m)),
        BudgetValues.Month => intervalCount,
        BudgetValues.Quarter => checked(intervalCount * 3),
        BudgetValues.Year => checked(intervalCount * 12),
        _ => throw new ArgumentOutOfRangeException(nameof(unit), "Unsupported reservation interval"),
    };
}

public sealed record CommitmentReservationSchedule(
    long RateCents,
    long CoverageCents,
    long ShortfallCents,
    IReadOnlyList<CommitmentReservationPeriod> Periods);
public sealed record CommitmentReservationPeriod(
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    long AmountCents,
    bool Eligible);
