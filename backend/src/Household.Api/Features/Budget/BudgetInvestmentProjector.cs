using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public sealed class BudgetInvestmentProjector(BudgetDbContext database)
{
    public async Task<InvestmentProjection> LoadAsync(
        Guid ownerId,
        DateOnly asOf,
        CancellationToken cancellationToken)
    {
        var events = await database.InvestmentEvents.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.OccurredOn <= asOf)
            .OrderBy(x => x.OccurredOn).ThenBy(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        var legacyOpening = await database.OpeningAllocations.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.Kind == BudgetValues.Investment && x.OccurredOn <= asOf)
            .SumAsync(x => x.AmountCents, cancellationToken);
        var contributedCapital = legacyOpening;
        var currentValue = legacyOpening;
        var withdrawals = 0L;
        DateOnly? latestValuationDate = null;
        foreach (var item in events)
        {
            switch (item.Kind)
            {
                case BudgetValues.Opening:
                case BudgetValues.Contribution:
                    contributedCapital = checked(contributedCapital + item.AmountCents);
                    currentValue = checked(currentValue + item.AmountCents);
                    break;
                case BudgetValues.Valuation:
                    currentValue = item.AmountCents;
                    latestValuationDate = item.OccurredOn;
                    break;
                case BudgetValues.Withdrawal:
                    withdrawals = checked(withdrawals + item.AmountCents);
                    currentValue = checked(currentValue - item.AmountCents);
                    break;
            }
        }
        var gain = checked(currentValue + withdrawals - contributedCapital);
        var gainBasisPoints = contributedCapital == 0
            ? 0
            : checked((long)Math.Truncate((decimal)gain * 10_000m / contributedCapital));
        return new InvestmentProjection(
            contributedCapital,
            Math.Max(0, currentValue),
            withdrawals,
            gain,
            gainBasisPoints,
            latestValuationDate,
            events.OrderByDescending(x => x.OccurredOn).ThenByDescending(x => x.CreatedAt)
                .Select(x => new InvestmentEventSummary(
                    x.Id, x.Kind, x.OccurredOn, x.Description, x.AmountCents,
                    x.Destination, x.TargetPurposeId)).ToList());
    }
}

public sealed record InvestmentProjection(
    long ContributedCapitalCents,
    long CurrentValueCents,
    long WithdrawnCents,
    long GainCents,
    long GainBasisPoints,
    DateOnly? LatestValuationDate,
    IReadOnlyList<InvestmentEventSummary> Events);
public sealed record InvestmentEventSummary(
    Guid Id,
    string Kind,
    DateOnly OccurredOn,
    string Description,
    long AmountCents,
    string? Destination,
    Guid? TargetPurposeId);
