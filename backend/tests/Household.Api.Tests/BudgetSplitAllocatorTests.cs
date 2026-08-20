using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class BudgetSplitAllocatorTests
{
    [Fact]
    public void Final_split_can_take_the_exact_remaining_minor_units()
    {
        var result = BudgetSplitAllocator.Allocate(10_001,
        [
            new SplitAllocationInput(3_333, false, true),
            new SplitAllocationInput(null, true, false),
        ]);

        Assert.Equal([3_333, 6_668], result.Select(x => x.AmountCents));
        Assert.Equal([-3_333, 0], result.Select(x => x.OrdinaryImpactCents));
    }

    [Theory]
    [InlineData(10_000, 9_000, 2_000)]
    [InlineData(10_000, 4_000, 5_000)]
    public void Split_amounts_must_neither_create_nor_lose_money(long total, long first, long second)
    {
        Assert.Throws<ArgumentException>(() => BudgetSplitAllocator.Allocate(total,
        [
            new SplitAllocationInput(first, false, true),
            new SplitAllocationInput(second, false, true),
        ]));
    }

    [Fact]
    public void Only_the_final_split_can_use_the_remainder()
    {
        Assert.Throws<ArgumentException>(() => BudgetSplitAllocator.Allocate(10_000,
        [
            new SplitAllocationInput(null, true, true),
            new SplitAllocationInput(10_000, false, true),
        ]));
    }
}
