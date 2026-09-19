namespace Household.Api.Features.Budget;

public static class BudgetSavingsGoalPlanner
{
    public static SavingsGoalPlan DateDriven(
        long targetCents,
        long planStartAllocatedCents,
        long currentAllocatedCents,
        DateOnly planStartedOn,
        DateOnly targetDate,
        DateOnly asOf,
        int preferredPeriodStartDay)
    {
        Validate(targetCents, planStartAllocatedCents, preferredPeriodStartDay);
        if (currentAllocatedCents < 0) throw new ArgumentOutOfRangeException(nameof(currentAllocatedCents));
        if (targetDate < planStartedOn)
            throw new ArgumentException("Target date must not be before the plan start");

        int originalPeriods = PeriodsInclusive(planStartedOn, targetDate, preferredPeriodStartDay);
        long originalRate = DivideRoundUp(Math.Max(0, targetCents - planStartAllocatedCents), originalPeriods);
        int elapsedPeriods = Math.Max(0, PeriodDistance(planStartedOn, asOf, preferredPeriodStartDay));
        long expectedCents = Math.Min(targetCents, checked(planStartAllocatedCents + originalRate * elapsedPeriods));
        int remainingPeriods = Math.Max(1, PeriodsInclusive(asOf, targetDate, preferredPeriodStartDay));
        long revisedRate = DivideRoundUp(Math.Max(0, targetCents - currentAllocatedCents), remainingPeriods);

        return new SavingsGoalPlan(
            originalRate,
            targetDate,
            revisedRate,
            targetDate,
            currentAllocatedCents < expectedCents,
            currentAllocatedCents >= targetCents);
    }

    public static SavingsGoalPlan RateDriven(
        long targetCents,
        long allocatedCents,
        long recurringContributionCents,
        DateOnly planStartedOn,
        DateOnly asOf,
        int preferredPeriodStartDay,
        DateOnly? originalForecastDate = null)
    {
        Validate(targetCents, allocatedCents, preferredPeriodStartDay);
        if (recurringContributionCents <= 0)
            throw new ArgumentOutOfRangeException(nameof(recurringContributionCents));

        DateOnly plannedDate = originalForecastDate ?? ForecastDate(
            targetCents, allocatedCents, recurringContributionCents, planStartedOn, preferredPeriodStartDay);
        DateOnly revisedDate = ForecastDate(
            targetCents, allocatedCents, recurringContributionCents, asOf, preferredPeriodStartDay);

        return new SavingsGoalPlan(
            recurringContributionCents,
            plannedDate,
            recurringContributionCents,
            revisedDate,
            revisedDate > plannedDate,
            allocatedCents >= targetCents);
    }

    public static DateOnly ForecastDate(
        long targetCents,
        long allocatedCents,
        long recurringContributionCents,
        DateOnly from,
        int preferredPeriodStartDay)
    {
        Validate(targetCents, allocatedCents, preferredPeriodStartDay);
        if (recurringContributionCents <= 0)
            throw new ArgumentOutOfRangeException(nameof(recurringContributionCents));
        if (allocatedCents >= targetCents) return from;

        long periods = DivideRoundUp(targetCents - allocatedCents, recurringContributionCents);
        BudgetPeriodRange first = BudgetPeriodCalendar.ForDate(from, preferredPeriodStartDay);
        return BudgetPeriodCalendar.ForDate(first.Start.AddMonths(checked((int)periods - 1)), preferredPeriodStartDay).End;
    }

    private static int PeriodsInclusive(DateOnly from, DateOnly through, int preferredPeriodStartDay) =>
        Math.Max(1, checked(PeriodDistance(from, through, preferredPeriodStartDay) + 1));

    private static int PeriodDistance(DateOnly from, DateOnly through, int preferredPeriodStartDay)
    {
        DateOnly first = BudgetPeriodCalendar.ForDate(from, preferredPeriodStartDay).Start;
        DateOnly last = BudgetPeriodCalendar.ForDate(through, preferredPeriodStartDay).Start;
        return checked((last.Year - first.Year) * 12 + last.Month - first.Month);
    }

    private static long DivideRoundUp(long value, long divisor) =>
        value == 0 ? 0 : checked((value + divisor - 1) / divisor);

    private static void Validate(long targetCents, long allocatedCents, int preferredPeriodStartDay)
    {
        if (targetCents <= 0) throw new ArgumentOutOfRangeException(nameof(targetCents));
        if (allocatedCents < 0) throw new ArgumentOutOfRangeException(nameof(allocatedCents));
        if (preferredPeriodStartDay is < 1 or > 31)
            throw new ArgumentOutOfRangeException(nameof(preferredPeriodStartDay));
    }
}

public sealed record SavingsGoalPlan(
    long PlannedContributionCents,
    DateOnly PlannedFundingDate,
    long RevisedContributionCents,
    DateOnly RevisedFundingDate,
    bool BehindPlan,
    bool FullyFunded);
