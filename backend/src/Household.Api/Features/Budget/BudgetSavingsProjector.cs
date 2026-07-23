using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public sealed class BudgetSavingsProjector(BudgetDbContext database)
{
    public async Task<SavingsProjection> LoadAsync(Guid ownerId, CancellationToken cancellationToken)
    {
        var purposes = await database.SavingsPurposes.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.ArchivedAt != null).ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);
        var contributions = await database.SavingsContributions.AsNoTracking().Include(x => x.Allocations)
            .Where(x => x.OwnerUserId == ownerId)
            .OrderByDescending(x => x.OccurredOn).ThenByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        var allocated = contributions.SelectMany(x => x.Allocations)
            .GroupBy(x => x.PurposeId).ToDictionary(x => x.Key, x => x.Sum(y => y.AmountCents));
        var opening = await database.OpeningAllocations.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.Kind == BudgetValues.Savings)
            .SumAsync(x => x.AmountCents, cancellationToken);
        var routedIncome = await database.IncomeVarianceAllocations.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.Destination == BudgetValues.Savings)
            .SumAsync(x => x.AmountCents, cancellationToken);
        var closeDispositions = await database.PeriodCloses.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.Disposition == BudgetValues.Savings)
            .SumAsync(x => x.DispositionAmountCents, cancellationToken);
        var externalUnallocated = checked(opening + routedIncome + closeDispositions);
        var total = checked(contributions.Sum(x => x.AmountCents) + externalUnallocated);
        return new SavingsProjection(
            total,
            checked(contributions.Sum(x => x.UnallocatedCents) + externalUnallocated),
            purposes.Select(x => new SavingsPurposeSummary(
                x.Id, x.Name, x.ArchivedAt is not null, allocated.GetValueOrDefault(x.Id))).ToList(),
            contributions.Select(x => new SavingsContributionSummary(
                x.Id, x.Kind, x.OccurredOn, x.Description, x.AmountCents, x.UnallocatedCents,
                x.Allocations.Select(y => new SavingsAllocationSummary(
                    y.Id, y.PurposeId, y.Mode, y.RequestedValue, y.AmountCents)).ToList())).ToList());
    }
}

public sealed record SavingsProjection(
    long TotalSavedCents,
    long UnallocatedCents,
    IReadOnlyList<SavingsPurposeSummary> Purposes,
    IReadOnlyList<SavingsContributionSummary> Contributions);
public sealed record SavingsPurposeSummary(Guid Id, string Name, bool Archived, long AllocatedCents);
public sealed record SavingsContributionSummary(
    Guid Id, string Kind, DateOnly OccurredOn, string Description, long AmountCents, long UnallocatedCents,
    IReadOnlyList<SavingsAllocationSummary> Allocations);
public sealed record SavingsAllocationSummary(
    Guid Id, Guid PurposeId, string Mode, long RequestedValue, long AmountCents);
