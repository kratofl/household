using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public sealed class BudgetIncomePostingService(
    BudgetDbContext database,
    BudgetService budgetService)
{
    public async Task<(BudgetIncomePosting Posting, bool AlreadyPosted)> ConfirmAsync(
        Guid ownerId,
        ExpectedIncomeOccurrence occurrence,
        DateOnly actualOn,
        long actualAmountCents,
        string postingMode,
        IncomeVarianceRuleInput? routingOverride,
        CancellationToken cancellationToken)
    {
        var existing = await database.IncomePostings.AsNoTracking().Include(x => x.Allocations)
            .SingleOrDefaultAsync(x => x.OwnerUserId == ownerId && x.SeriesId == occurrence.SeriesId &&
                                       x.ScheduledOn == occurrence.ScheduledOn, cancellationToken);
        if (existing is not null) return (existing, true);
        if (actualAmountCents <= 0) throw new ArgumentOutOfRangeException(nameof(actualAmountCents));
        if (postingMode is not (BudgetValues.Manual or BudgetValues.Automatic))
            throw new ArgumentException("Posting mode is invalid", nameof(postingMode));

        var positiveVariance = Math.Max(0, actualAmountCents - occurrence.AmountCents);
        var rule = routingOverride ?? await EffectiveRuleAsync(ownerId, occurrence.SeriesId, cancellationToken);
        var routed = BudgetIncomeVarianceRouter.Route(positiveVariance, rule.Mode, rule.Routes);
        var protectedVariance = routed.Where(x => x.Destination != BudgetValues.Ordinary).Sum(x => x.AmountCents);
        var ordinaryIncome = checked(actualAmountCents - protectedVariance);
        var (period, _, _) = await budgetService.EnsureDefaultsAsync(ownerId, actualOn, cancellationToken);
        var postingId = Guid.NewGuid();
        var ledgerEntryId = Guid.NewGuid();
        var ledgerEntry = new BudgetLedgerEntry
        {
            Id = ledgerEntryId, OwnerUserId = ownerId, PeriodId = period.Id, Kind = BudgetValues.Income,
            OccurredOn = actualOn, Description = occurrence.Name, AmountCents = actualAmountCents,
            OrdinaryImpactCents = ordinaryIncome,
            Source = postingMode == BudgetValues.Automatic ? "income_automatic" : "income_confirmation",
            SourceRecordId = postingId,
        };
        var posting = new BudgetIncomePosting
        {
            Id = postingId, OwnerUserId = ownerId, SeriesId = occurrence.SeriesId, VersionId = occurrence.VersionId,
            ScheduledOn = occurrence.ScheduledOn, ExpectedOn = occurrence.OccurredOn, ActualOn = actualOn,
            ExpectedAmountCents = occurrence.AmountCents, ActualAmountCents = actualAmountCents,
            VarianceCents = checked(actualAmountCents - occurrence.AmountCents), PostingMode = postingMode,
            LedgerEntryId = ledgerEntryId,
        };
        foreach (var allocation in routed)
            posting.Allocations.Add(new BudgetIncomeVarianceAllocation
            {
                OwnerUserId = ownerId, PostingId = postingId, Destination = allocation.Destination,
                TargetId = allocation.TargetId, AmountCents = allocation.AmountCents,
            });

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            database.LedgerEntries.Add(ledgerEntry);
            await database.SaveChangesAsync(cancellationToken);
            database.IncomePostings.Add(posting);
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return (posting, false);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            database.ChangeTracker.Clear();
            var winner = await database.IncomePostings.AsNoTracking().Include(x => x.Allocations)
                .SingleOrDefaultAsync(x => x.OwnerUserId == ownerId && x.SeriesId == occurrence.SeriesId &&
                                           x.ScheduledOn == occurrence.ScheduledOn, cancellationToken);
            if (winner is not null) return (winner, true);
            throw;
        }
    }

    private async Task<IncomeVarianceRuleInput> EffectiveRuleAsync(
        Guid ownerId, Guid seriesId, CancellationToken cancellationToken)
    {
        var rule = await database.IncomeVarianceRules.AsNoTracking().Include(x => x.Routes)
            .Where(x => x.OwnerUserId == ownerId && x.SeriesId == seriesId)
            .OrderByDescending(x => x.EffectiveFrom).ThenByDescending(x => x.Id)
            .FirstOrDefaultAsync(cancellationToken)
            ?? await database.IncomeVarianceRules.AsNoTracking().Include(x => x.Routes)
                .Where(x => x.OwnerUserId == ownerId && x.SeriesId == null)
                .OrderByDescending(x => x.EffectiveFrom).ThenByDescending(x => x.Id)
                .FirstOrDefaultAsync(cancellationToken);
        return rule is null
            ? new IncomeVarianceRuleInput(BudgetValues.Fixed, [])
            : new IncomeVarianceRuleInput(
                rule.Mode,
                rule.Routes.OrderBy(x => x.Position)
                    .Select(x => new IncomeVarianceRouteInput(x.Destination, x.Value, x.TargetId)).ToList());
    }
}

public sealed record IncomeVarianceRuleInput(string Mode, IReadOnlyList<IncomeVarianceRouteInput> Routes);
