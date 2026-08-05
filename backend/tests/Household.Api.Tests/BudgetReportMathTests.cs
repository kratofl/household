using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class BudgetReportMathTests
{
    [Fact]
    public void Positive_shares_sum_to_exactly_ten_thousand_basis_points()
    {
        var shares = BudgetReportMath.ShareBasisPoints([1, 1, 1]);

        Assert.Equal(10_000, shares.Sum());
        Assert.Equal([3_333, 3_333, 3_334], shares);
    }

    [Theory]
    [InlineData(new long[] { 1, 1, 1 })]
    [InlineData(new long[] { 7, 11, 13, 17, 19 })]
    [InlineData(new long[] { 999_999_999_999, 1, 3 })]
    public void Non_dividing_totals_still_sum_to_ten_thousand(long[] parts)
    {
        Assert.Equal(10_000, BudgetReportMath.ShareBasisPoints(parts).Sum());
    }

    [Fact]
    public void Single_positive_part_takes_the_full_share()
    {
        Assert.Equal([10_000L], BudgetReportMath.ShareBasisPoints([1]));
    }

    [Fact]
    public void Negative_and_zero_parts_get_no_share_and_do_not_change_the_denominator()
    {
        var shares = BudgetReportMath.ShareBasisPoints([-500, 0, 2_500, 7_500]);

        Assert.Equal([0, 0, 2_500, 7_500], shares);
    }

    [Fact]
    public void All_non_positive_parts_yield_zero_shares()
    {
        Assert.Equal([0L, 0L], BudgetReportMath.ShareBasisPoints([-1, 0]));
        Assert.Empty(BudgetReportMath.ShareBasisPoints([]));
    }

    [Theory]
    [InlineData(10_000, 11_000, 1_000)]
    [InlineData(10_000, 9_000, -1_000)]
    [InlineData(10_000, 10_000, 0)]
    [InlineData(3, 4, 3_333)]
    [InlineData(3, 2, -3_333)]
    public void Change_basis_points_use_exact_truncated_integer_math(long baseline, long value, long expected)
    {
        Assert.Equal(expected, BudgetReportMath.ChangeBasisPoints(baseline, value));
    }

    [Fact]
    public void Change_against_a_zero_baseline_is_null()
    {
        Assert.Null(BudgetReportMath.ChangeBasisPoints(0, 5_000));
    }

    [Theory]
    [InlineData(2_500, 10_000, 2_500)]
    [InlineData(1, 3, 3_333)]
    [InlineData(15_000, 10_000, 15_000)]
    [InlineData(0, 10_000, 0)]
    public void Ratio_basis_points_use_exact_truncated_integer_math(long part, long total, long expected)
    {
        Assert.Equal(expected, BudgetReportMath.RatioBasisPoints(part, total));
    }

    [Fact]
    public void Ratio_against_a_zero_total_is_null()
    {
        Assert.Null(BudgetReportMath.RatioBasisPoints(5_000, 0));
    }

    [Fact]
    public void Large_values_near_the_long_range_do_not_overflow()
    {
        var large = long.MaxValue / 20_000;

        Assert.Equal(10_000, BudgetReportMath.ShareBasisPoints([large, large]).Sum());
        Assert.Equal(10_000, BudgetReportMath.ChangeBasisPoints(large, checked(large * 2)));
    }
}
