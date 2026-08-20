namespace Household.Api.Features.Budget;

public readonly record struct BudgetAvailabilityResult(
    long TargetBufferCents,
    long FundedBufferCents,
    long BufferShortfallCents,
    long MaximumOrdinaryCents,
    long OrdinaryAvailableCents);

public static class BudgetAvailability
{
    public static BudgetAvailabilityResult Calculate(
        long actualIncomeCents,
        long ordinaryImpactCents,
        string bufferRule,
        long bufferAmountCents,
        int bufferPercentageBasisPoints,
        long explicitBufferCents = 0,
        long savingsCents = 0,
        long investmentCents = 0,
        long reservationCents = 0)
    {
        var target = bufferRule == BudgetValues.PercentageBuffer
            ? checked(actualIncomeCents * bufferPercentageBasisPoints / 10_000)
            : bufferAmountCents;
        var longTermAllocations = Math.Max(0, checked(savingsCents + investmentCents));
        var protectedReservations = Math.Max(0, reservationCents);
        var bufferCapacity = Math.Max(0, actualIncomeCents - longTermAllocations - protectedReservations);
        var fundedBuffer = Math.Min(bufferCapacity, Math.Max(0, checked(target + explicitBufferCents)));
        var maximumOrdinary = Math.Max(0, actualIncomeCents - fundedBuffer - longTermAllocations - protectedReservations);
        var protectedTarget = Math.Max(0, checked(target + explicitBufferCents));
        return new BudgetAvailabilityResult(
            protectedTarget,
            fundedBuffer,
            Math.Max(0, protectedTarget - fundedBuffer),
            maximumOrdinary,
            maximumOrdinary + ordinaryImpactCents);
    }
}
