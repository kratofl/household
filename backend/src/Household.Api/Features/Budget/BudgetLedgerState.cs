namespace Household.Api.Features.Budget;

public readonly record struct LedgerStateEntry(Guid Id, Guid? CorrectsEntryId);

public static class BudgetLedgerState
{
    public static IReadOnlyList<Guid> EffectiveIds(IReadOnlyList<LedgerStateEntry> entries, IReadOnlySet<Guid> voidedIds)
    {
        var superseded = entries.Where(x => x.CorrectsEntryId.HasValue).Select(x => x.CorrectsEntryId!.Value).ToHashSet();
        return entries.Where(x => !superseded.Contains(x.Id) && !voidedIds.Contains(x.Id)).Select(x => x.Id).ToList();
    }

    public static long RefundImpact(long originalOrdinaryImpactCents, long originalAmountCents, long refundAmountCents)
    {
        if (originalAmountCents <= 0 || refundAmountCents <= 0 || refundAmountCents > originalAmountCents)
            throw new ArgumentOutOfRangeException(nameof(refundAmountCents));
        if (originalOrdinaryImpactCents >= 0) return 0;
        return checked(-originalOrdinaryImpactCents * refundAmountCents / originalAmountCents);
    }
}
