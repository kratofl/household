using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public sealed class BudgetCommitmentProjector(BudgetDbContext database)
{
    public async Task<CommitmentProjection> LoadAsync(
        Guid ownerId, DateOnly from, DateOnly through, CancellationToken cancellationToken)
    {
        if (through < from || through.DayNumber - from.DayNumber > 366 * 5)
            throw new ArgumentOutOfRangeException(nameof(through), "Commitment forecast range must be between zero and five years");
        var versions = await database.CommitmentPlans.AsNoTracking().Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.SeriesId).ThenBy(x => x.EffectiveFrom).ThenBy(x => x.CreatedAt).ToListAsync(cancellationToken);
        var pauses = await database.CommitmentPauses.AsNoTracking().Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.From).ToListAsync(cancellationToken);
        var stops = await database.CommitmentStops.AsNoTracking().Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.EffectiveOn).ToListAsync(cancellationToken);
        var overrides = await database.CommitmentOccurrenceOverrides.AsNoTracking().Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).ToListAsync(cancellationToken);
        var postings = await database.CommitmentPostings.AsNoTracking().Where(x => x.OwnerUserId == ownerId)
            .ToListAsync(cancellationToken);
        var stopBySeries = stops.GroupBy(x => x.SeriesId).ToDictionary(x => x.Key, x => x.Min(y => y.EffectiveOn));
        var pausesBySeries = pauses.GroupBy(x => x.SeriesId).ToDictionary(x => x.Key, x => x.ToList());
        var overridesByOccurrence = overrides.GroupBy(x => (x.SeriesId, x.ScheduledOn)).ToDictionary(x => x.Key, x => x.Last());
        var postingsByOccurrence = postings.ToDictionary(x => (x.SeriesId, x.ScheduledOn));
        var plans = new List<CommitmentSummary>();
        var occurrences = new List<ExpectedCommitmentOccurrence>();

        foreach (var series in versions.GroupBy(x => x.SeriesId))
        {
            var ordered = series.OrderBy(x => x.EffectiveFrom).ThenBy(x => x.CreatedAt).ToList();
            var current = ordered.LastOrDefault(x => x.Active && x.EffectiveTo == null) ?? ordered.Last();
            stopBySeries.TryGetValue(series.Key, out var stoppedOn);
            var seriesPauses = pausesBySeries.GetValueOrDefault(series.Key) ?? [];
            plans.Add(new CommitmentSummary(
                series.Key, current.CategoryId, current.Kind, current.Name, current.AmountCents, current.Cadence,
                current.IntervalUnit, current.IntervalCount,
                BudgetIncomePlanProjector.ParseWeekdays(current.Weekdays).Select(x => (int)x).Order().ToArray(),
                current.StartDate, current.BudgetingMode, current.AutomaticPosting,
                stoppedOn == default ? null : stoppedOn,
                seriesPauses.Select(x => new CommitmentPauseSummary(x.Id, x.From, x.Through, x.Reason)).ToList(),
                ordered.Select(x => new CommitmentVersionSummary(
                    x.Id, x.EffectiveFrom, x.EffectiveTo, x.CategoryId, x.Kind, x.Name, x.AmountCents,
                    x.Cadence, x.IntervalUnit, x.IntervalCount,
                    BudgetIncomePlanProjector.ParseWeekdays(x.Weekdays).Select(y => (int)y).Order().ToArray(),
                    x.BudgetingMode, x.AutomaticPosting, x.ChangeReason, x.Active)).ToList()));

            foreach (var version in ordered.Where(x => x.Active))
            {
                var effectiveFrom = new[] { from, version.StartDate, version.EffectiveFrom }.Max();
                var effectiveThrough = new[]
                {
                    through, version.EffectiveTo ?? through,
                    stoppedOn == default ? through : stoppedOn.AddDays(-1),
                }.Min();
                if (effectiveThrough < effectiveFrom) continue;
                var schedule = new RecurrenceSchedule(
                    version.StartDate, BudgetIncomePlanProjector.ParseUnit(version.IntervalUnit), version.IntervalCount,
                    BudgetIncomePlanProjector.ParseWeekdays(version.Weekdays));
                foreach (var scheduledOn in BudgetRecurrence.Between(schedule, effectiveFrom, effectiveThrough))
                {
                    if (seriesPauses.Any(x => scheduledOn >= x.From && scheduledOn <= x.Through)) continue;
                    overridesByOccurrence.TryGetValue((series.Key, scheduledOn), out var occurrenceOverride);
                    postingsByOccurrence.TryGetValue((series.Key, scheduledOn), out var posting);
                    occurrences.Add(new ExpectedCommitmentOccurrence(
                        $"commitment:{series.Key}:{scheduledOn:yyyy-MM-dd}", series.Key, version.Id,
                        version.CategoryId, version.Kind, scheduledOn, occurrenceOverride?.OccurredOn ?? scheduledOn,
                        occurrenceOverride?.Name ?? version.Name, occurrenceOverride?.AmountCents ?? version.AmountCents,
                        version.BudgetingMode, occurrenceOverride is not null,
                        posting is null ? "expected" : posting.PostingMode == BudgetValues.Automatic ? "automatically_posted" : "confirmed",
                        posting is null ? null : new CommitmentPostingSummary(
                            posting.Id, posting.LedgerEntryId, posting.ActualOn, posting.ActualAmountCents, posting.PostingMode)));
                }
            }
        }
        return new CommitmentProjection(
            plans.OrderBy(x => x.StoppedOn.HasValue).ThenBy(x => x.Name).ToList(),
            occurrences.OrderBy(x => x.OccurredOn).ThenBy(x => x.Name).ToList());
    }
}

public sealed record CommitmentProjection(
    IReadOnlyList<CommitmentSummary> Plans, IReadOnlyList<ExpectedCommitmentOccurrence> Occurrences);
public sealed record CommitmentSummary(
    Guid SeriesId, Guid? CategoryId, string Kind, string Name, long AmountCents, string Cadence,
    string IntervalUnit, int IntervalCount, IReadOnlyList<int> Weekdays, DateOnly StartDate,
    string BudgetingMode, bool AutomaticPosting, DateOnly? StoppedOn,
    IReadOnlyList<CommitmentPauseSummary> Pauses, IReadOnlyList<CommitmentVersionSummary> Versions);
public sealed record CommitmentPauseSummary(Guid Id, DateOnly From, DateOnly Through, string Reason);
public sealed record CommitmentVersionSummary(
    Guid Id, DateOnly EffectiveFrom, DateOnly? EffectiveTo, Guid? CategoryId, string Kind, string Name,
    long AmountCents, string Cadence, string IntervalUnit, int IntervalCount, IReadOnlyList<int> Weekdays,
    string BudgetingMode, bool AutomaticPosting, string ChangeReason, bool Active);
public sealed record ExpectedCommitmentOccurrence(
    string Id, Guid SeriesId, Guid VersionId, Guid? CategoryId, string Kind, DateOnly ScheduledOn,
    DateOnly OccurredOn, string Name, long AmountCents, string BudgetingMode, bool Overridden,
    string Status, CommitmentPostingSummary? Posting);
public sealed record CommitmentPostingSummary(
    Guid Id, Guid LedgerEntryId, DateOnly ActualOn, long ActualAmountCents, string PostingMode);
