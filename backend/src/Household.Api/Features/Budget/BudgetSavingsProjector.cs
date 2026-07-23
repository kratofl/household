using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public sealed class BudgetSavingsProjector(BudgetDbContext database)
{
    public async Task<SavingsProjection> LoadAsync(
        Guid ownerId,
        DateOnly asOf,
        CancellationToken cancellationToken)
    {
        var purposes = await database.SavingsPurposes.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.ArchivedAt != null).ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);
        var contributions = await database.SavingsContributions.AsNoTracking().Include(x => x.Allocations)
            .Where(x => x.OwnerUserId == ownerId && x.OccurredOn <= asOf)
            .OrderByDescending(x => x.OccurredOn).ThenByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        var purchases = await database.SavingsPurchases.AsNoTracking().Include(x => x.Funding)
            .Where(x => x.OwnerUserId == ownerId && x.OccurredOn <= asOf)
            .OrderByDescending(x => x.OccurredOn).ThenByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        var purchaseLedgerIds = purchases.Select(x => x.LedgerEntryId).ToHashSet();
        var ineffectiveLedgerIds = (await database.LedgerActions.AsNoTracking()
                .Where(x => x.OwnerUserId == ownerId && x.Kind == BudgetValues.Void &&
                            purchaseLedgerIds.Contains(x.LedgerEntryId))
                .Select(x => x.LedgerEntryId).ToListAsync(cancellationToken))
            .Concat(await database.LedgerEntries.AsNoTracking()
                .Where(x => x.OwnerUserId == ownerId && x.CorrectsEntryId.HasValue &&
                            purchaseLedgerIds.Contains(x.CorrectsEntryId.Value))
                .Select(x => x.CorrectsEntryId!.Value).ToListAsync(cancellationToken))
            .ToHashSet();
        var refundedByLedgerId = await database.LedgerEntries.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.Kind == BudgetValues.Refund &&
                        x.RelatedEntryId.HasValue && purchaseLedgerIds.Contains(x.RelatedEntryId.Value) &&
                        x.OccurredOn <= asOf)
            .GroupBy(x => x.RelatedEntryId!.Value)
            .Select(x => new { LedgerId = x.Key, Amount = x.Sum(y => y.AmountCents) })
            .ToDictionaryAsync(x => x.LedgerId, x => x.Amount, cancellationToken);

        var consumedFunding = purchases.SelectMany(purchase =>
            EffectiveFunding(purchase, ineffectiveLedgerIds.Contains(purchase.LedgerEntryId)
                ? 0
                : Math.Max(0, purchase.AmountCents - refundedByLedgerId.GetValueOrDefault(purchase.LedgerEntryId))))
            .ToList();
        var incomingAllocated = contributions.SelectMany(x => x.Allocations)
            .GroupBy(x => x.PurposeId).ToDictionary(x => x.Key, x => x.Sum(y => y.AmountCents));
        var consumedByPurpose = consumedFunding.Where(x => x.Source == BudgetValues.Goal && x.PurposeId.HasValue)
            .GroupBy(x => x.PurposeId!.Value).ToDictionary(x => x.Key, x => x.Sum(y => y.AmountCents));
        var balances = purposes.ToDictionary(
            x => x.Id,
            x => checked(incomingAllocated.GetValueOrDefault(x.Id) - consumedByPurpose.GetValueOrDefault(x.Id)));

        var opening = await database.OpeningAllocations.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.Kind == BudgetValues.Savings && x.OccurredOn <= asOf)
            .SumAsync(x => x.AmountCents, cancellationToken);
        var routedIncome = await database.IncomeVarianceAllocations.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.Destination == BudgetValues.Savings)
            .SumAsync(x => x.AmountCents, cancellationToken);
        var closeDispositions = await (
                from close in database.PeriodCloses.AsNoTracking()
                join period in database.Periods.AsNoTracking() on close.PeriodId equals period.Id
                where close.OwnerUserId == ownerId && close.Disposition == BudgetValues.Savings &&
                      period.EndDate <= asOf
                select close.DispositionAmountCents)
            .SumAsync(cancellationToken);
        var externalUnallocated = checked(opening + routedIncome + closeDispositions);
        var consumedSavings = consumedFunding.Where(x => x.Source == BudgetValues.Goal).Sum(x => x.AmountCents);
        var total = checked(contributions.Sum(x => x.AmountCents) + externalUnallocated - consumedSavings);
        var preferredStartDay = await database.Settings.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId)
            .Select(x => (int?)x.PreferredPeriodStartDay)
            .SingleOrDefaultAsync(cancellationToken) ?? 1;

        return new SavingsProjection(
            total,
            checked(contributions.Sum(x => x.UnallocatedCents) + externalUnallocated),
            purposes.Select(x => PurposeSummary(x, balances.GetValueOrDefault(x.Id), asOf, preferredStartDay)).ToList(),
            contributions.Select(x => new SavingsContributionSummary(
                x.Id, x.Kind, x.OccurredOn, x.Description, x.AmountCents, x.UnallocatedCents,
                x.Allocations.Select(y => new SavingsAllocationSummary(
                    y.Id, y.PurposeId, y.Mode, y.RequestedValue, y.AmountCents)).ToList())).ToList(),
            purchases.Select(x => new SavingsPurchaseSummary(
                x.Id, x.LedgerEntryId, x.OccurredOn, x.Description, x.AmountCents,
                ineffectiveLedgerIds.Contains(x.LedgerEntryId) ? "voided" :
                    refundedByLedgerId.GetValueOrDefault(x.LedgerEntryId) == x.AmountCents ? "refunded" :
                    refundedByLedgerId.ContainsKey(x.LedgerEntryId) ? "partially_refunded" : "actual",
                EffectiveFunding(x, ineffectiveLedgerIds.Contains(x.LedgerEntryId)
                    ? 0
                    : Math.Max(0, x.AmountCents - refundedByLedgerId.GetValueOrDefault(x.LedgerEntryId)))
                    .Select(y => new SavingsPurchaseFundingSummary(y.Source, y.PurposeId, y.AmountCents)).ToList()))
                .ToList());
    }

    private static SavingsPurposeSummary PurposeSummary(
        BudgetSavingsPurpose purpose,
        long balanceCents,
        DateOnly asOf,
        int preferredStartDay)
    {
        SavingsGoalPlan? plan = purpose.PlanningMode switch
        {
            BudgetValues.DateDriven when purpose.TargetAmountCents.HasValue && purpose.PlanStartedOn.HasValue &&
                                         purpose.TargetDate.HasValue =>
                BudgetSavingsGoalPlanner.DateDriven(
                    purpose.TargetAmountCents.Value, purpose.PlanStartAllocatedCents, balanceCents,
                    purpose.PlanStartedOn.Value, purpose.TargetDate.Value, asOf, preferredStartDay),
            BudgetValues.RateDriven when purpose.TargetAmountCents.HasValue && purpose.PlanStartedOn.HasValue &&
                                         purpose.TargetDate.HasValue && purpose.RecurringContributionCents.HasValue =>
                BudgetSavingsGoalPlanner.RateDriven(
                    purpose.TargetAmountCents.Value, balanceCents, purpose.RecurringContributionCents.Value,
                    purpose.PlanStartedOn.Value, asOf, preferredStartDay, purpose.TargetDate.Value),
            _ => null,
        };
        var status = purpose.CompletedAt.HasValue ? "completed" :
            plan?.FullyFunded == true ? "fully_funded" :
            plan?.BehindPlan == true ? "behind" : "active";
        return new SavingsPurposeSummary(
            purpose.Id, purpose.Name, purpose.ArchivedAt is not null, balanceCents,
            purpose.TargetAmountCents, purpose.PlanningMode, purpose.TargetDate,
            plan?.PlannedContributionCents, plan?.RevisedContributionCents,
            plan?.PlannedFundingDate, plan?.RevisedFundingDate,
            status, purpose.ContributionsPaused || purpose.CompletedAt.HasValue);
    }

    private static IReadOnlyList<EffectivePurchaseFunding> EffectiveFunding(
        BudgetSavingsPurchase purchase,
        long effectivePurchaseAmount)
    {
        if (effectivePurchaseAmount <= 0) return [];
        var funding = purchase.Funding.OrderBy(x => x.Sequence).ToList();
        var result = new List<EffectivePurchaseFunding>(funding.Count);
        var allocated = 0L;
        for (var index = 0; index < funding.Count; index++)
        {
            var source = funding[index];
            var amount = index == funding.Count - 1
                ? effectivePurchaseAmount - allocated
                : checked(source.AmountCents * effectivePurchaseAmount / purchase.AmountCents);
            allocated += amount;
            if (amount > 0) result.Add(new EffectivePurchaseFunding(source.Source, source.PurposeId, amount));
        }
        return result;
    }
}

internal sealed record EffectivePurchaseFunding(string Source, Guid? PurposeId, long AmountCents);

public sealed record SavingsProjection(
    long TotalSavedCents,
    long UnallocatedCents,
    IReadOnlyList<SavingsPurposeSummary> Purposes,
    IReadOnlyList<SavingsContributionSummary> Contributions,
    IReadOnlyList<SavingsPurchaseSummary> Purchases);
public sealed record SavingsPurposeSummary(
    Guid Id,
    string Name,
    bool Archived,
    long AllocatedCents,
    long? TargetAmountCents,
    string? PlanningMode,
    DateOnly? TargetDate,
    long? PlannedContributionCents,
    long? RevisedContributionCents,
    DateOnly? PlannedFundingDate,
    DateOnly? RevisedFundingDate,
    string Status,
    bool ContributionsPaused);
public sealed record SavingsContributionSummary(
    Guid Id, string Kind, DateOnly OccurredOn, string Description, long AmountCents, long UnallocatedCents,
    IReadOnlyList<SavingsAllocationSummary> Allocations);
public sealed record SavingsAllocationSummary(
    Guid Id, Guid PurposeId, string Mode, long RequestedValue, long AmountCents);
public sealed record SavingsPurchaseSummary(
    Guid Id,
    Guid LedgerEntryId,
    DateOnly OccurredOn,
    string Description,
    long AmountCents,
    string Status,
    IReadOnlyList<SavingsPurchaseFundingSummary> Funding);
public sealed record SavingsPurchaseFundingSummary(string Source, Guid? PurposeId, long AmountCents);
