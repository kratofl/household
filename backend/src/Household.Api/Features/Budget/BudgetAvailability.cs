namespace Household.Api.Features.Budget;

public readonly record struct BudgetAvailabilityResult(
    long FundedBufferCents,
    long MaximumOrdinaryCents,
    long OrdinaryAvailableCents);

public static class BudgetAvailability
{
    public static BudgetAvailabilityResult Calculate(
        long actualIncomeCents,
        long ordinaryImpactCents,
        string bufferRule,
        long bufferAmountCents,
        int bufferPercentageBasisPoints)
    {
        var target = bufferRule == BudgetValues.PercentageBuffer
            ? checked(actualIncomeCents * bufferPercentageBasisPoints / 10_000)
            : bufferAmountCents;
        var fundedBuffer = Math.Min(Math.Max(0, actualIncomeCents), Math.Max(0, target));
        var maximumOrdinary = Math.Max(0, actualIncomeCents - fundedBuffer);
        return new BudgetAvailabilityResult(fundedBuffer, maximumOrdinary, maximumOrdinary + ordinaryImpactCents);
    }
}
