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

        int periodCount = CyclePeriodCount(version.IntervalUnit, version.IntervalCount);
        BudgetPeriodRange duePeriod = BudgetPeriodCalendar.ForDate(scheduledOn, preferredPeriodStartDay);
        List<BudgetPeriodRange> periods = new List<BudgetPeriodRange>(periodCount);
        BudgetPeriodRange cursor = BudgetPeriodCalendar.ForDate(duePeriod.Start.AddDays(-1), preferredPeriodStartDay);
        for (int index = 0; index < periodCount; index++)
        {
            periods.Add(cursor);
            cursor = BudgetPeriodCalendar.ForDate(cursor.Start.AddDays(-1), preferredPeriodStartDay);
        }
        periods.Reverse();

        DateOnly createdOn = version.CreatedAt == default
            ? version.EffectiveFrom
            : DateOnly.FromDateTime(version.CreatedAt);
        DateOnly reservationBeginsOn = string.IsNullOrEmpty(version.ChangeReason)
            ? createdOn
            : new[] { createdOn, version.EffectiveFrom }.Max();
        long baseAmount = version.AmountCents / periodCount;
        long remainder = version.AmountCents % periodCount;
        List<CommitmentReservationPeriod> entries = periods.Select((period, index) => new CommitmentReservationPeriod(
                period.Start,
                period.End,
                baseAmount + (index < remainder ? 1 : 0),
                period.End >= reservationBeginsOn))
            .ToList();
        long coverage = entries.Where(x => x.Eligible).Sum(x => x.AmountCents);
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
