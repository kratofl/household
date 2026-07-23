using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class BudgetAvailabilityTests
{
    [Theory]
    [InlineData(300_000, -75_000, "fixed", 25_000, 0, 25_000, 200_000)]
    [InlineData(300_000, -75_000, "percentage", 0, 1_000, 30_000, 195_000)]
    [InlineData(10_000, 0, "fixed", 25_000, 0, 10_000, 0)]
    [InlineData(0, -5_000, "fixed", 25_000, 0, 0, -5_000)]
    public void Availability_uses_only_actual_income_ordinary_impacts_and_fundable_buffer(
        long actualIncomeCents,
        long ordinaryImpactCents,
        string bufferRule,
        long bufferAmountCents,
        int bufferBasisPoints,
        long expectedBufferCents,
        long expectedAvailableCents)
    {
        var result = BudgetAvailability.Calculate(
            actualIncomeCents,
            ordinaryImpactCents,
            bufferRule,
            bufferAmountCents,
            bufferBasisPoints);

        Assert.Equal(expectedBufferCents, result.FundedBufferCents);
        Assert.Equal(expectedAvailableCents, result.OrdinaryAvailableCents);
        Assert.Equal(Math.Max(0, actualIncomeCents - expectedBufferCents), result.MaximumOrdinaryCents);
    }

    [Fact]
    public void Explicit_variance_allocations_remain_protected_from_ordinary_spending()
    {
        var result = BudgetAvailability.Calculate(
            120_000, 0, BudgetValues.FixedBuffer, 10_000, 0,
            explicitBufferCents: 5_000, savingsCents: 3_000, investmentCents: 2_000);

        Assert.Equal(15_000, result.FundedBufferCents);
        Assert.Equal(100_000, result.MaximumOrdinaryCents);
        Assert.Equal(100_000, result.OrdinaryAvailableCents);
    }
}
