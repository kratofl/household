namespace Household.Api.Features.Budget;

public readonly record struct SplitAllocationInput(long? AmountCents, bool UseRemaining, bool AffectsOrdinary);
public readonly record struct SplitAllocation(long AmountCents, long OrdinaryImpactCents);

public static class BudgetSplitAllocator
{
    public static IReadOnlyList<SplitAllocation> Allocate(long totalAmountCents, IReadOnlyList<SplitAllocationInput> inputs)
    {
        if (totalAmountCents <= 0 || inputs.Count == 0) throw new ArgumentException("A positive total and at least one split are required.");
        long allocated = 0L;
        List<SplitAllocation> result = new List<SplitAllocation>(inputs.Count);
        for (int index = 0; index < inputs.Count; index++)
        {
            SplitAllocationInput input = inputs[index];
            if (input.UseRemaining && index != inputs.Count - 1) throw new ArgumentException("Only the final split can use the remainder.");
            if (input.UseRemaining && input.AmountCents.HasValue) throw new ArgumentException("A remainder split cannot also declare an amount.");
            long amount = input.UseRemaining ? totalAmountCents - allocated : input.AmountCents ?? 0;
            if (amount <= 0 || amount > totalAmountCents - allocated) throw new ArgumentException("Split amounts exceed or do not cover the transaction total.");
            allocated = checked(allocated + amount);
            result.Add(new SplitAllocation(amount, input.AffectsOrdinary ? -amount : 0));
        }
        if (allocated != totalAmountCents) throw new ArgumentException("Split amounts must exactly equal the transaction total.");
        return result;
    }
}
