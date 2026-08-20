namespace Household.Api.Features.Budget;

public static class BudgetReportMath
{
    // Shares are integer basis points (10_000 = 100%) over the sum of positive parts.
    // Non-positive parts get 0. The last positive part takes the rounding remainder so
    // positive shares always sum to exactly 10_000.
    public static IReadOnlyList<long> ShareBasisPoints(IReadOnlyList<long> parts)
    {
        var shares = new long[parts.Count];
        var total = 0L;
        foreach (var part in parts) if (part > 0) total = checked(total + part);
        if (total <= 0) return shares;
        var assigned = 0L;
        var lastPositive = -1;
        for (var index = 0; index < parts.Count; index++)
        {
            if (parts[index] <= 0) continue;
            shares[index] = checked((long)(parts[index] * 10_000m / total));
            assigned = checked(assigned + shares[index]);
            lastPositive = index;
        }
        shares[lastPositive] = checked(shares[lastPositive] + 10_000 - assigned);
        return shares;
    }

    // Relative change of value against a baseline in basis points, truncated toward zero.
    // A zero baseline has no meaningful relative change and yields null.
    public static long? ChangeBasisPoints(long baselineCents, long valueCents) =>
        baselineCents == 0 ? null : checked((long)((valueCents - baselineCents) * 10_000m / baselineCents));

    // Part of a total in basis points, truncated toward zero; null when the total is zero.
    public static long? RatioBasisPoints(long partCents, long totalCents) =>
        totalCents == 0 ? null : checked((long)(partCents * 10_000m / totalCents));
}
