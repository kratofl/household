using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class BudgetLedgerStateTests
{
    [Fact]
    public void Only_the_latest_non_voided_correction_affects_financial_projections()
    {
        var original = Guid.NewGuid();
        var correction = Guid.NewGuid();
        var latest = Guid.NewGuid();
        var voided = Guid.NewGuid();

        var effective = BudgetLedgerState.EffectiveIds(
        [
            new LedgerStateEntry(original, null),
            new LedgerStateEntry(correction, original),
            new LedgerStateEntry(latest, correction),
            new LedgerStateEntry(voided, null),
        ],
        new HashSet<Guid> { voided });

        Assert.Equal([latest], effective);
    }

    [Theory]
    [InlineData(-10_000, 10_000, 10_000, 10_000)]
    [InlineData(-10_000, 10_000, 2_500, 2_500)]
    [InlineData(0, 10_000, 5_000, 0)]
    public void Refund_impact_restores_only_the_original_ordinary_share(
        long originalImpact,
        long originalAmount,
        long refundAmount,
        long expectedImpact)
    {
        Assert.Equal(expectedImpact, BudgetLedgerState.RefundImpact(originalImpact, originalAmount, refundAmount));
    }
}
