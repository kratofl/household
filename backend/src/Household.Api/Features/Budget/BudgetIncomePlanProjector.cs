using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public sealed class BudgetIncomePlanProjector(BudgetDbContext database)
{
    public async Task<IncomePlanProjection> LoadAsync(
        Guid ownerId, DateOnly from, DateOnly through, CancellationToken cancellationToken)
    {
        if (through < from || through.DayNumber - from.DayNumber > 366 * 5)
            throw new ArgumentOutOfRangeException(nameof(through), "Income forecast range must be between zero and five years");

        var versions = await database.IncomePlans.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.SeriesId).ThenBy(x => x.EffectiveFrom).ThenBy(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        var pauses = await database.IncomePlanPauses.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId).OrderBy(x => x.From).ToListAsync(cancellationToken);
        var stops = await database.IncomePlanStops.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId).OrderBy(x => x.EffectiveOn).ToListAsync(cancellationToken);
        var overrides = await database.IncomeOccurrenceOverrides.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId).OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).ToListAsync(cancellationToken);
        var postings = await database.IncomePostings.AsNoTracking().Include(x => x.Allocations)
            .Where(x => x.OwnerUserId == ownerId).ToListAsync(cancellationToken);

        var stopBySeries = stops.GroupBy(x => x.SeriesId).ToDictionary(x => x.Key, x => x.Min(y => y.EffectiveOn));
        var pausesBySeries = pauses.GroupBy(x => x.SeriesId).ToDictionary(x => x.Key, x => x.ToList());
        var overrideByOccurrence = overrides.GroupBy(x => (x.SeriesId, x.ScheduledOn))
            .ToDictionary(x => x.Key, x => x.Last());
        var postingByOccurrence = postings.ToDictionary(x => (x.SeriesId, x.ScheduledOn));
        var projectedPlans = new List<IncomePlanSummary>();
        var occurrences = new List<ExpectedIncomeOccurrence>();

        foreach (var series in versions.GroupBy(x => x.SeriesId))
        {
            var ordered = series.OrderBy(x => x.EffectiveFrom).ThenBy(x => x.CreatedAt).ToList();
            var current = ordered.LastOrDefault(x => x.Active && x.EffectiveTo == null) ?? ordered.Last();
            stopBySeries.TryGetValue(series.Key, out var stoppedOn);
            var seriesPauses = pausesBySeries.GetValueOrDefault(series.Key) ?? [];
            projectedPlans.Add(new IncomePlanSummary(
                series.Key, current.Name, current.AmountCents, current.Cadence, current.IntervalUnit,
                current.IntervalCount, ParseWeekdays(current.Weekdays).Select(x => (int)x).Order().ToArray(),
                current.StartDate, current.AutomaticPosting, stoppedOn == default ? null : stoppedOn,
                seriesPauses.Select(x => new IncomePauseSummary(x.Id, x.From, x.Through, x.Reason)).ToList(),
                ordered.Select(x => new IncomePlanVersionSummary(
                    x.Id, x.EffectiveFrom, x.EffectiveTo, x.Name, x.AmountCents, x.Cadence,
                    x.IntervalUnit, x.IntervalCount, ParseWeekdays(x.Weekdays).Select(y => (int)y).Order().ToArray(),
                    x.AutomaticPosting, x.ChangeReason, x.Active)).ToList()));

            foreach (var version in ordered.Where(x => x.Active))
            {
                var effectiveFrom = Max(from, version.StartDate, version.EffectiveFrom);
                var effectiveThrough = Min(through, version.EffectiveTo ?? through,
                    stoppedOn == default ? through : stoppedOn.AddDays(-1));
                if (effectiveThrough < effectiveFrom) continue;
                var schedule = new RecurrenceSchedule(
                    version.StartDate, ParseUnit(version.IntervalUnit), version.IntervalCount, ParseWeekdays(version.Weekdays));
                foreach (var scheduledOn in BudgetRecurrence.Between(schedule, effectiveFrom, effectiveThrough))
                {
                    if (seriesPauses.Any(x => scheduledOn >= x.From && scheduledOn <= x.Through)) continue;
                    overrideByOccurrence.TryGetValue((series.Key, scheduledOn), out var occurrenceOverride);
                    postingByOccurrence.TryGetValue((series.Key, scheduledOn), out var posting);
                    occurrences.Add(new ExpectedIncomeOccurrence(
                        $"income:{series.Key}:{scheduledOn:yyyy-MM-dd}", series.Key, version.Id, scheduledOn,
                        occurrenceOverride?.OccurredOn ?? scheduledOn,
                        occurrenceOverride?.Name ?? version.Name,
                        occurrenceOverride?.AmountCents ?? version.AmountCents,
                        occurrenceOverride is not null,
                        posting is null ? "expected" : posting.PostingMode == BudgetValues.Automatic ? "automatically_posted" : "confirmed",
                        posting is null ? null : new IncomePostingSummary(
                            posting.Id, posting.LedgerEntryId, posting.ActualOn, posting.ActualAmountCents,
                            posting.VarianceCents, posting.PostingMode,
                            posting.Allocations.Select(x => new IncomeAllocationSummary(x.Destination, x.TargetId, x.AmountCents)).ToList())));
                }
            }
        }

        return new IncomePlanProjection(
            projectedPlans.OrderBy(x => x.StoppedOn.HasValue).ThenBy(x => x.Name).ToList(),
            occurrences.OrderBy(x => x.OccurredOn).ThenBy(x => x.Name).ToList());
    }

    public static RecurrenceUnit ParseUnit(string value) => value switch
    {
        BudgetValues.Day => RecurrenceUnit.Day,
        BudgetValues.Week => RecurrenceUnit.Week,
        BudgetValues.Month => RecurrenceUnit.Month,
        BudgetValues.Quarter => RecurrenceUnit.Quarter,
        BudgetValues.Year => RecurrenceUnit.Year,
        _ => throw new ArgumentException("Unsupported recurrence unit", nameof(value)),
    };

    public static IReadOnlyCollection<DayOfWeek> ParseWeekdays(string value) => string.IsNullOrWhiteSpace(value)
        ? []
        : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => (DayOfWeek)int.Parse(x, System.Globalization.CultureInfo.InvariantCulture)).Distinct().ToArray();

    private static DateOnly Max(params DateOnly[] dates) => dates.Max();
    private static DateOnly Min(params DateOnly[] dates) => dates.Min();
}

public sealed record IncomePlanProjection(
    IReadOnlyList<IncomePlanSummary> Plans,
    IReadOnlyList<ExpectedIncomeOccurrence> Occurrences);
public sealed record IncomePlanSummary(
    Guid SeriesId, string Name, long AmountCents, string Cadence, string IntervalUnit, int IntervalCount,
    IReadOnlyList<int> Weekdays, DateOnly StartDate, bool AutomaticPosting, DateOnly? StoppedOn,
    IReadOnlyList<IncomePauseSummary> Pauses, IReadOnlyList<IncomePlanVersionSummary> Versions);
public sealed record IncomePauseSummary(Guid Id, DateOnly From, DateOnly Through, string Reason);
public sealed record IncomePlanVersionSummary(
    Guid Id, DateOnly EffectiveFrom, DateOnly? EffectiveTo, string Name, long AmountCents,
    string Cadence, string IntervalUnit, int IntervalCount, IReadOnlyList<int> Weekdays,
    bool AutomaticPosting, string ChangeReason, bool Active);
public sealed record ExpectedIncomeOccurrence(
    string Id, Guid SeriesId, Guid VersionId, DateOnly ScheduledOn, DateOnly OccurredOn,
    string Name, long AmountCents, bool Overridden, string Status, IncomePostingSummary? Posting);
public sealed record IncomePostingSummary(
    Guid Id, Guid LedgerEntryId, DateOnly ActualOn, long ActualAmountCents, long VarianceCents,
    string PostingMode, IReadOnlyList<IncomeAllocationSummary> Allocations);
public sealed record IncomeAllocationSummary(string Destination, Guid? TargetId, long AmountCents);
