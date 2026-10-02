using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static class BudgetReportEndpoints
{
    public static RouteGroupBuilder MapBudgetReportEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapGet("/reports/period-comparison", PeriodComparison);
        budget.MapGet("/reports/category-spend", CategorySpend);
        budget.MapGet("/reports/merchant-spend", MerchantSpend);
        budget.MapGet("/reports/planned-vs-actual", PlannedVsActual);
        budget.MapGet("/reports/income", IncomeReport);
        budget.MapGet("/reports/buffer", BufferReport);
        budget.MapGet("/reports/savings-goals", SavingsGoals);
        budget.MapGet("/reports/investments", Investments);
        return budget;
    }

    private static async Task<IResult> CategorySpend(
        string? from, string? through, Guid? categoryId, string? merchant,
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        (DateOnly rangeFrom, DateOnly rangeThrough, IResult? rangeError) = await RangeAsync(from, through, user.Id, database, timeProvider, cancellationToken);
        if (rangeError is not null) return rangeError;
        IResult? categoryError = await CategoryFilterErrorAsync(categoryId, user.Id, database, cancellationToken);
        if (categoryError is not null) return categoryError;
        string? merchantNormalized = NormalizedMerchant(merchant);
        List<BudgetLedgerEntry> entries = await EffectiveEntriesAsync(database, user.Id, rangeFrom, rangeThrough, cancellationToken);
        List<(BudgetLedgerEntry Entry, Guid? CategoryId, string Name, string Color, string Icon, long SignedCents)> contributions = SpendContributions(entries.Where(x => merchantNormalized is null || x.MerchantNormalized == merchantNormalized))
            .Where(x => !categoryId.HasValue || x.CategoryId == categoryId).ToList();
        var groups = contributions.GroupBy(x => x.CategoryId).Select(group =>
        {
            (string Name, string Color, string Icon) snapshot = group.Where(x => x.Name != "")
                .OrderByDescending(x => x.Entry.OccurredOn).ThenByDescending(x => x.Entry.CreatedAt)
                .Select(x => (x.Name, x.Color, x.Icon)).FirstOrDefault();
            return new
            {
                CategoryId = group.Key,
                Name = snapshot.Name ?? "",
                Color = snapshot.Color ?? "",
                Icon = snapshot.Icon ?? "",
                Gross = group.Where(x => x.SignedCents > 0).Sum(x => x.SignedCents),
                Refund = -group.Where(x => x.SignedCents < 0).Sum(x => x.SignedCents),
                Net = group.Sum(x => x.SignedCents),
                EntryCount = group.Select(x => x.Entry.Id).Distinct().Count(),
            };
        }).OrderByDescending(x => x.Net).ThenBy(x => x.Name).ToList();
        IReadOnlyList<long> shares = BudgetReportMath.ShareBasisPoints(groups.Select(x => x.Net).ToList());
        List<BudgetCategorySpendRow> rows = groups.Select((row, index) => new BudgetCategorySpendRow(
            row.CategoryId, row.Name, row.Color, row.Icon,
            row.Gross, row.Refund, row.Net, shares[index], row.EntryCount)).ToList();
        return Results.Ok(new BudgetCategorySpendReport(
            rangeFrom, rangeThrough, categoryId, merchantNormalized,
            rows.Sum(x => x.GrossExpenseCents), rows.Sum(x => x.RefundCents), rows.Sum(x => x.NetSpentCents), rows));
    }

    private static async Task<IResult> MerchantSpend(
        string? from, string? through, Guid? categoryId, string? merchant,
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        (DateOnly rangeFrom, DateOnly rangeThrough, IResult? rangeError) = await RangeAsync(from, through, user.Id, database, timeProvider, cancellationToken);
        if (rangeError is not null) return rangeError;
        IResult? categoryError = await CategoryFilterErrorAsync(categoryId, user.Id, database, cancellationToken);
        if (categoryError is not null) return categoryError;
        string? merchantNormalized = NormalizedMerchant(merchant);
        List<BudgetLedgerEntry> entries = await EffectiveEntriesAsync(database, user.Id, rangeFrom, rangeThrough, cancellationToken);
        List<BudgetLedgerEntry> filtered = entries.Where(x =>
            x.Kind is BudgetValues.Expense or BudgetValues.Refund &&
            (merchantNormalized is null || x.MerchantNormalized == merchantNormalized) &&
            (!categoryId.HasValue || x.CategoryId == categoryId || x.Splits.Any(split => split.CategoryId == categoryId))).ToList();
        var groups = filtered.GroupBy(x => new { x.MerchantNormalized, x.MerchantBrandKey }).Select(group => new
        {
            Merchant = group.Key.MerchantNormalized,
            BrandKey = group.Key.MerchantBrandKey,
            Gross = group.Where(x => x.Kind == BudgetValues.Expense).Sum(x => x.AmountCents),
            Refund = group.Where(x => x.Kind == BudgetValues.Refund).Sum(x => x.AmountCents),
            EntryCount = group.Count(),
        }).Select(x => new { x.Merchant, x.BrandKey, x.Gross, x.Refund, Net = checked(x.Gross - x.Refund), x.EntryCount })
            .OrderByDescending(x => x.Net).ThenBy(x => x.Merchant).ToList();
        IReadOnlyList<long> shares = BudgetReportMath.ShareBasisPoints(groups.Select(x => x.Net).ToList());
        List<BudgetMerchantSpendRow> rows = groups.Select((row, index) => new BudgetMerchantSpendRow(
            row.Merchant, row.BrandKey, row.Gross, row.Refund, row.Net, shares[index], row.EntryCount)).ToList();
        return Results.Ok(new BudgetMerchantSpendReport(
            rangeFrom, rangeThrough, categoryId, merchantNormalized,
            rows.Sum(x => x.GrossExpenseCents), rows.Sum(x => x.RefundCents), rows.Sum(x => x.NetSpentCents), rows));
    }

    private static async Task<IResult> PeriodComparison(
        string? from, string? through, Guid? categoryId, string? merchant,
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        (DateOnly rangeFrom, DateOnly rangeThrough, IResult? rangeError) = await RangeAsync(from, through, user.Id, database, timeProvider, cancellationToken);
        if (rangeError is not null) return rangeError;
        IResult? categoryError = await CategoryFilterErrorAsync(categoryId, user.Id, database, cancellationToken);
        if (categoryError is not null) return categoryError;
        string? merchantNormalized = NormalizedMerchant(merchant);
        List<BudgetPeriod> periods = await database.Periods.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.EndDate >= rangeFrom && x.StartDate <= rangeThrough)
            .OrderBy(x => x.StartDate).ToListAsync(cancellationToken);
        if (periods.Count == 0)
            return Results.Ok(new BudgetPeriodComparisonReport(rangeFrom, rangeThrough, categoryId, merchantNormalized, []));
        HashSet<Guid> periodIds = periods.Select(x => x.Id).ToHashSet();
        List<BudgetLedgerEntry> entries = await EffectiveEntriesAsync(
            database, user.Id, periods.Min(x => x.StartDate), periods.Max(x => x.EndDate), cancellationToken);
        Dictionary<Guid, BudgetPeriodClose> closes = await database.PeriodCloses.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && periodIds.Contains(x.PeriodId))
            .ToDictionaryAsync(x => x.PeriodId, cancellationToken);
        Dictionary<Guid, long> savings = await database.SavingsContributions.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.Kind == BudgetValues.Contribution && periodIds.Contains(x.PeriodId))
            .GroupBy(x => x.PeriodId).Select(x => new { PeriodId = x.Key, Amount = x.Sum(item => item.AmountCents) })
            .ToDictionaryAsync(x => x.PeriodId, x => x.Amount, cancellationToken);
        Dictionary<Guid, long> investments = await database.InvestmentEvents.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.Kind == BudgetValues.Contribution && periodIds.Contains(x.PeriodId))
            .GroupBy(x => x.PeriodId).Select(x => new { PeriodId = x.Key, Amount = x.Sum(item => item.AmountCents) })
            .ToDictionaryAsync(x => x.PeriodId, x => x.Amount, cancellationToken);
        List<BudgetPeriodComparisonRow> rows = new List<BudgetPeriodComparisonRow>();
        long? previousNet = null;
        foreach (BudgetPeriod? period in periods)
        {
            List<BudgetLedgerEntry> periodEntries = entries.Where(x => x.PeriodId == period.Id).ToList();
            long incomeCents = periodEntries.Where(x => x.Kind == BudgetValues.Income).Sum(x => x.AmountCents);
            List<(BudgetLedgerEntry Entry, Guid? CategoryId, string Name, string Color, string Icon, long SignedCents)> contributions = SpendContributions(periodEntries.Where(x =>
                    merchantNormalized is null || x.MerchantNormalized == merchantNormalized))
                .Where(x => !categoryId.HasValue || x.CategoryId == categoryId).ToList();
            long gross = contributions.Where(x => x.SignedCents > 0).Sum(x => x.SignedCents);
            long refund = -contributions.Where(x => x.SignedCents < 0).Sum(x => x.SignedCents);
            long net = contributions.Sum(x => x.SignedCents);
            BudgetPeriodClose? close = closes.GetValueOrDefault(period.Id);
            rows.Add(new BudgetPeriodComparisonRow(
                period.Id, period.Name, period.StartDate, period.EndDate, close is not null,
                incomeCents, gross, refund, net,
                savings.GetValueOrDefault(period.Id), investments.GetValueOrDefault(period.Id),
                close?.FundedBufferCents, close?.RetainedBufferCents,
                previousNet.HasValue ? BudgetReportMath.ChangeBasisPoints(previousNet.Value, net) : null));
            previousNet = net;
        }
        return Results.Ok(new BudgetPeriodComparisonReport(rangeFrom, rangeThrough, categoryId, merchantNormalized, rows));
    }

    private static async Task<IResult> PlannedVsActual(
        string? from, string? through, Guid? categoryId,
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        (DateOnly rangeFrom, DateOnly rangeThrough, IResult? rangeError) = await RangeAsync(from, through, user.Id, database, timeProvider, cancellationToken);
        if (rangeError is not null) return rangeError;
        IResult? categoryError = await CategoryFilterErrorAsync(categoryId, user.Id, database, cancellationToken);
        if (categoryError is not null) return categoryError;
        IncomePlanProjection incomeProjection;
        CommitmentProjection commitmentProjection;
        try
        {
            incomeProjection = await new BudgetIncomePlanProjector(database).LoadAsync(user.Id, rangeFrom, rangeThrough, cancellationToken);
            commitmentProjection = await new BudgetCommitmentProjector(database).LoadAsync(user.Id, rangeFrom, rangeThrough, cancellationToken);
        }
        catch (ArgumentOutOfRangeException exception)
        {
            return Invalid(exception.Message);
        }
        var ledger = await database.LedgerEntries.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id)
            .Select(x => new { x.Id, x.CorrectsEntryId, x.AmountCents, x.CreatedAt }).ToListAsync(cancellationToken);
        HashSet<Guid> voided = (await database.LedgerActions.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.Kind == BudgetValues.Void)
            .Select(x => x.LedgerEntryId).ToListAsync(cancellationToken)).ToHashSet();
        Dictionary<Guid, long> byId = ledger.ToDictionary(x => x.Id, x => x.AmountCents);
        Dictionary<Guid, Guid> correctedBy = ledger.Where(x => x.CorrectsEntryId.HasValue)
            .GroupBy(x => x.CorrectsEntryId!.Value)
            .ToDictionary(x => x.Key, x => x.OrderByDescending(item => item.CreatedAt).First().Id);
        long EffectiveActual(Guid ledgerEntryId)
        {
            Guid id = ledgerEntryId;
            int guard = 0;
            while (correctedBy.TryGetValue(id, out Guid next) && guard++ < 1_000) id = next;
            return voided.Contains(id) ? 0 : byId.GetValueOrDefault(id);
        }
        List<BudgetPlannedVsActualRow> incomeRows = categoryId.HasValue
            ? []
            : incomeProjection.Plans.Select(plan =>
            {
                List<ExpectedIncomeOccurrence> occurrences = incomeProjection.Occurrences.Where(x => x.SeriesId == plan.SeriesId).ToList();
                long planned = occurrences.Sum(x => x.AmountCents);
                long actual = occurrences.Where(x => x.Posting is not null).Sum(x => EffectiveActual(x.Posting!.LedgerEntryId));
                return new BudgetPlannedVsActualRow(
                    plan.SeriesId, plan.Name, BudgetValues.Income, null, planned, actual,
                    checked(actual - planned), BudgetReportMath.ChangeBasisPoints(planned, actual),
                    occurrences.Count, occurrences.Count(x => x.Posting is not null));
            }).Where(x => x.OccurrenceCount > 0).OrderBy(x => x.Name).ToList();
        List<BudgetPlannedVsActualRow> commitmentRows = commitmentProjection.Plans.Select(plan =>
        {
            List<ExpectedCommitmentOccurrence> occurrences = commitmentProjection.Occurrences.Where(x =>
                x.SeriesId == plan.SeriesId && (!categoryId.HasValue || x.CategoryId == categoryId)).ToList();
            long planned = occurrences.Sum(x => x.AmountCents);
            long actual = occurrences.Where(x => x.Posting is not null).Sum(x => EffectiveActual(x.Posting!.LedgerEntryId));
            return new BudgetPlannedVsActualRow(
                plan.SeriesId, plan.Name, plan.Kind, plan.CategoryId, planned, actual,
                checked(actual - planned), BudgetReportMath.ChangeBasisPoints(planned, actual),
                occurrences.Count, occurrences.Count(x => x.Posting is not null));
        }).Where(x => x.OccurrenceCount > 0).OrderBy(x => x.Name).ToList();
        long plannedTotal = incomeRows.Sum(x => x.PlannedCents) + commitmentRows.Sum(x => x.PlannedCents);
        long actualTotal = incomeRows.Sum(x => x.ActualCents) + commitmentRows.Sum(x => x.ActualCents);
        return Results.Ok(new BudgetPlannedVsActualReport(
            rangeFrom, rangeThrough, categoryId, plannedTotal, actualTotal,
            checked(actualTotal - plannedTotal), BudgetReportMath.ChangeBasisPoints(plannedTotal, actualTotal),
            incomeRows, commitmentRows));
    }

    private static async Task<IResult> IncomeReport(
        string? from, string? through,
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        (DateOnly rangeFrom, DateOnly rangeThrough, IResult? rangeError) = await RangeAsync(from, through, user.Id, database, timeProvider, cancellationToken);
        if (rangeError is not null) return rangeError;
        IncomePlanProjection projection;
        try
        {
            projection = await new BudgetIncomePlanProjector(database).LoadAsync(user.Id, rangeFrom, rangeThrough, cancellationToken);
        }
        catch (ArgumentOutOfRangeException exception)
        {
            return Invalid(exception.Message);
        }
        List<BudgetLedgerEntry> entries = await EffectiveEntriesAsync(database, user.Id, rangeFrom, rangeThrough, cancellationToken);
        List<BudgetLedgerEntry> incomeEntries = entries.Where(x => x.Kind == BudgetValues.Income).ToList();
        HashSet<Guid> postingIds = incomeEntries.Where(x => x.SourceRecordId.HasValue).Select(x => x.SourceRecordId!.Value).ToHashSet();
        List<BudgetIncomeRoutingRow> routing = await database.IncomeVarianceAllocations.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && postingIds.Contains(x.PostingId))
            .GroupBy(x => x.Destination)
            .Select(x => new BudgetIncomeRoutingRow(x.Key, x.Sum(item => item.AmountCents)))
            .ToListAsync(cancellationToken);
        List<BudgetPeriod> periods = await database.Periods.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.EndDate >= rangeFrom && x.StartDate <= rangeThrough)
            .OrderBy(x => x.StartDate).ToListAsync(cancellationToken);
        List<BudgetIncomeReportRow> rows = periods.Select(period =>
        {
            long expected = projection.Occurrences
                .Where(x => x.OccurredOn >= period.StartDate && x.OccurredOn <= period.EndDate).Sum(x => x.AmountCents);
            long actual = incomeEntries.Where(x => x.PeriodId == period.Id).Sum(x => x.AmountCents);
            return new BudgetIncomeReportRow(
                period.Id, period.Name, period.StartDate, period.EndDate, expected, actual,
                checked(actual - expected), BudgetReportMath.ChangeBasisPoints(expected, actual));
        }).ToList();
        long expectedTotal = projection.Occurrences.Sum(x => x.AmountCents);
        long actualTotal = incomeEntries.Sum(x => x.AmountCents);
        return Results.Ok(new BudgetIncomeReport(
            rangeFrom, rangeThrough, expectedTotal, actualTotal, checked(actualTotal - expectedTotal),
            BudgetReportMath.ChangeBasisPoints(expectedTotal, actualTotal),
            routing.OrderBy(x => x.Destination).ToList(), rows));
    }

    private static async Task<IResult> BufferReport(
        string? from, string? through,
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        BudgetService budgetService, TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        (DateOnly rangeFrom, DateOnly rangeThrough, IResult? rangeError) = await RangeAsync(from, through, user.Id, database, timeProvider, cancellationToken);
        if (rangeError is not null) return rangeError;
        List<BudgetPeriod> periods = await database.Periods.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.EndDate >= rangeFrom && x.StartDate <= rangeThrough)
            .OrderBy(x => x.StartDate).ToListAsync(cancellationToken);
        Dictionary<Guid, BudgetPeriodClose> closes = await database.PeriodCloses.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && periods.Select(period => period.Id).Contains(x.PeriodId))
            .ToDictionaryAsync(x => x.PeriodId, cancellationToken);
        DateOnly today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        List<BudgetBufferReportRow> rows = new List<BudgetBufferReportRow>();
        foreach (BudgetPeriod? period in periods)
        {
            if (closes.TryGetValue(period.Id, out BudgetPeriodClose? close))
            {
                rows.Add(new BudgetBufferReportRow(
                    period.Id, period.Name, period.StartDate, period.EndDate, false,
                    close.ForecastBufferTargetCents, close.ActualBufferTargetCents, close.FundedBufferCents,
                    close.BufferShortfallCents,
                    BudgetReportMath.RatioBasisPoints(close.FundedBufferCents, close.ActualBufferTargetCents),
                    close.DeficitCents, close.CoveredFromBufferCents, close.CarriedDeficitCents,
                    close.Disposition, close.DispositionAmountCents, close.RetainedBufferCents,
                    close.RetainedBufferCents, close.ClosedAt));
                continue;
            }
            if (today < period.StartDate || today > period.EndDate) continue;
            BudgetSummary summary = await budgetService.SummaryAsync(user.Id, today, cancellationToken);
            rows.Add(new BudgetBufferReportRow(
                period.Id, period.Name, period.StartDate, period.EndDate, true,
                summary.ForecastBufferTargetCents, summary.ActualBufferTargetCents, summary.FundedBufferCents,
                summary.BufferShortfallCents,
                BudgetReportMath.RatioBasisPoints(summary.FundedBufferCents, summary.ActualBufferTargetCents),
                null, null, null, null, null, null, summary.ProtectedBufferCents, null));
        }
        return Results.Ok(new BudgetBufferReport(rangeFrom, rangeThrough, rows));
    }

    private static async Task<IResult> SavingsGoals(
        string? from, string? through,
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        (DateOnly rangeFrom, DateOnly rangeThrough, IResult? rangeError) = await RangeAsync(from, through, user.Id, database, timeProvider, cancellationToken);
        if (rangeError is not null) return rangeError;
        SavingsProjection projection = await new BudgetSavingsProjector(database).LoadAsync(user.Id, rangeThrough, cancellationToken);
        Dictionary<Guid, long> allocatedInRange = projection.Contributions
            .Where(x => x.OccurredOn >= rangeFrom && x.OccurredOn <= rangeThrough)
            .SelectMany(x => x.Allocations)
            .GroupBy(x => x.PurposeId).ToDictionary(x => x.Key, x => x.Sum(item => item.AmountCents));
        Dictionary<Guid, long> consumedInRange = projection.Purchases
            .Where(x => x.OccurredOn >= rangeFrom && x.OccurredOn <= rangeThrough && x.Status != "voided")
            .SelectMany(x => x.Funding)
            .Where(x => x.PurposeId.HasValue)
            .GroupBy(x => x.PurposeId!.Value).ToDictionary(x => x.Key, x => x.Sum(item => item.AmountCents));
        List<BudgetSavingsGoalReportRow> rows = projection.Purposes.Select(purpose => new BudgetSavingsGoalReportRow(
            purpose.Id, purpose.Name, purpose.Status, purpose.Archived,
            purpose.TargetAmountCents, purpose.AllocatedCents,
            purpose.TargetAmountCents.HasValue
                ? BudgetReportMath.RatioBasisPoints(purpose.AllocatedCents, purpose.TargetAmountCents.Value)
                : null,
            allocatedInRange.GetValueOrDefault(purpose.Id), consumedInRange.GetValueOrDefault(purpose.Id),
            purpose.PlannedContributionCents, purpose.RevisedContributionCents,
            purpose.PlannedFundingDate, purpose.RevisedFundingDate, purpose.ContributionsPaused)).ToList();
        return Results.Ok(new BudgetSavingsGoalReport(
            rangeFrom, rangeThrough, projection.TotalSavedCents, projection.UnallocatedCents, rows));
    }

    private static async Task<IResult> Investments(
        string? from, string? through,
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        (DateOnly rangeFrom, DateOnly rangeThrough, IResult? rangeError) = await RangeAsync(from, through, user.Id, database, timeProvider, cancellationToken);
        if (rangeError is not null) return rangeError;
        BudgetInvestmentProjector projector = new BudgetInvestmentProjector(database);
        InvestmentProjection end = await projector.LoadAsync(user.Id, rangeThrough, cancellationToken);
        InvestmentProjection start = await projector.LoadAsync(user.Id, rangeFrom.AddDays(-1), cancellationToken);
        List<InvestmentEventSummary> events = end.Events.Where(x => x.OccurredOn >= rangeFrom && x.OccurredOn <= rangeThrough).ToList();
        return Results.Ok(new BudgetInvestmentReport(
            rangeFrom, rangeThrough,
            end.ContributedCapitalCents, end.CurrentValueCents, end.WithdrawnCents,
            end.GainCents, end.GainBasisPoints, end.LatestValuationDate,
            checked(end.ContributedCapitalCents - start.ContributedCapitalCents),
            checked(end.CurrentValueCents - start.CurrentValueCents), events));
    }

    // Effective corrected state over a date range: corrections supersede their originals
    // globally (a correction may live in another period) and voided entries are excluded.
    private static async Task<List<BudgetLedgerEntry>> EffectiveEntriesAsync(
        BudgetDbContext database, Guid ownerId, DateOnly from, DateOnly through, CancellationToken cancellationToken)
    {
        List<BudgetLedgerEntry> entries = await database.LedgerEntries.AsNoTracking().Include(x => x.Splits)
            .Where(x => x.OwnerUserId == ownerId && x.OccurredOn >= from && x.OccurredOn <= through)
            .OrderBy(x => x.OccurredOn).ThenBy(x => x.CreatedAt).ToListAsync(cancellationToken);
        HashSet<Guid> voided = (await database.LedgerActions.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.Kind == BudgetValues.Void)
            .Select(x => x.LedgerEntryId).ToListAsync(cancellationToken)).ToHashSet();
        HashSet<Guid> superseded = (await database.LedgerEntries.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.CorrectsEntryId.HasValue)
            .Select(x => x.CorrectsEntryId!.Value).ToListAsync(cancellationToken)).ToHashSet();
        return entries.Where(x => !voided.Contains(x.Id) && !superseded.Contains(x.Id)).ToList();
    }

    // Spend contributions per category with historical snapshots: expense splits add,
    // refund splits subtract in their receipt period; entries without splits count as
    // uncategorized via the entry amount.
    private static IEnumerable<(BudgetLedgerEntry Entry, Guid? CategoryId, string Name, string Color, string Icon, long SignedCents)>
        SpendContributions(IEnumerable<BudgetLedgerEntry> entries)
    {
        foreach (BudgetLedgerEntry? entry in entries.Where(x => x.Kind is BudgetValues.Expense or BudgetValues.Refund))
        {
            int sign = entry.Kind == BudgetValues.Refund ? -1 : 1;
            if (entry.Splits.Count == 0)
            {
                yield return (entry, entry.CategoryId, "", "", "", sign * entry.AmountCents);
                continue;
            }
            foreach (BudgetLedgerSplit split in entry.Splits)
                yield return (entry, split.CategoryId, split.CategoryNameSnapshot, split.CategoryColorSnapshot,
                    split.CategoryIconSnapshot, sign * split.AmountCents);
        }
    }

    private static async Task<(DateOnly From, DateOnly Through, IResult? Error)> RangeAsync(
        string? from, string? through, Guid ownerId, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        DateOnly end = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        if (!string.IsNullOrWhiteSpace(through) && !TryDate(through, out end))
            return (default, default, InvalidDate("through"));
        DateOnly start;
        if (string.IsNullOrWhiteSpace(from))
        {
            int preferredStartDay = await database.Settings.AsNoTracking()
                .Where(x => x.OwnerUserId == ownerId).Select(x => (int?)x.PreferredPeriodStartDay)
                .SingleOrDefaultAsync(cancellationToken) ?? 1;
            start = BudgetPeriodCalendar.ForDate(end.AddMonths(-5), preferredStartDay).Start;
        }
        else if (!TryDate(from, out start))
        {
            return (default, default, InvalidDate("from"));
        }
        if (end < start) return (default, default, Invalid("through must not be before from"));
        return (start, end, null);
    }

    private static async Task<IResult?> CategoryFilterErrorAsync(
        Guid? categoryId, Guid ownerId, BudgetDbContext database, CancellationToken cancellationToken) =>
        categoryId.HasValue && !await database.Categories.AsNoTracking()
            .AnyAsync(x => x.Id == categoryId && x.OwnerUserId == ownerId, cancellationToken)
            ? HttpResults.Problem(404, "Not found", "Category was not found")
            : null;

    private static string? NormalizedMerchant(string? merchant) =>
        string.IsNullOrWhiteSpace(merchant) ? null : MerchantPresentation.From(merchant).Normalized;

    private static bool TryDate(string? value, out DateOnly date) => DateOnly.TryParseExact(
        value, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out date);
    private static IResult InvalidDate(string field) => HttpResults.Problem(400, "Invalid date", $"{field} must use YYYY-MM-DD");
    private static IResult Invalid(string detail) => HttpResults.Problem(422, "Validation failed", detail);
    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
}

public sealed record BudgetCategorySpendReport(
    DateOnly From, DateOnly Through, Guid? CategoryId, string? Merchant,
    long TotalGrossExpenseCents, long TotalRefundCents, long TotalNetSpentCents,
    IReadOnlyList<BudgetCategorySpendRow> Rows);
public sealed record BudgetCategorySpendRow(
    Guid? CategoryId, string Name, string Color, string Icon,
    long GrossExpenseCents, long RefundCents, long NetSpentCents, long ShareBasisPoints, int EntryCount);
public sealed record BudgetMerchantSpendReport(
    DateOnly From, DateOnly Through, Guid? CategoryId, string? Merchant,
    long TotalGrossExpenseCents, long TotalRefundCents, long TotalNetSpentCents,
    IReadOnlyList<BudgetMerchantSpendRow> Rows);
public sealed record BudgetMerchantSpendRow(
    string Merchant, string? BrandKey,
    long GrossExpenseCents, long RefundCents, long NetSpentCents, long ShareBasisPoints, int EntryCount);
public sealed record BudgetPeriodComparisonReport(
    DateOnly From, DateOnly Through, Guid? CategoryId, string? Merchant,
    IReadOnlyList<BudgetPeriodComparisonRow> Rows);
public sealed record BudgetPeriodComparisonRow(
    Guid PeriodId, string Name, DateOnly StartDate, DateOnly EndDate, bool Closed,
    long IncomeCents, long GrossExpenseCents, long RefundCents, long NetSpendCents,
    long SavingsContributionCents, long InvestmentContributionCents,
    long? FundedBufferCents, long? RetainedBufferCents, long? ChangeVsPreviousBasisPoints);
public sealed record BudgetPlannedVsActualReport(
    DateOnly From, DateOnly Through, Guid? CategoryId,
    long PlannedCents, long ActualCents, long VarianceCents, long? VarianceBasisPoints,
    IReadOnlyList<BudgetPlannedVsActualRow> Income, IReadOnlyList<BudgetPlannedVsActualRow> Commitments);
public sealed record BudgetPlannedVsActualRow(
    Guid SeriesId, string Name, string Kind, Guid? CategoryId,
    long PlannedCents, long ActualCents, long VarianceCents, long? VarianceBasisPoints,
    int OccurrenceCount, int PostedCount);
public sealed record BudgetIncomeReport(
    DateOnly From, DateOnly Through,
    long ExpectedCents, long ActualCents, long VarianceCents, long? VarianceBasisPoints,
    IReadOnlyList<BudgetIncomeRoutingRow> Routing, IReadOnlyList<BudgetIncomeReportRow> Rows);
public sealed record BudgetIncomeRoutingRow(string Destination, long AmountCents);
public sealed record BudgetIncomeReportRow(
    Guid PeriodId, string Name, DateOnly StartDate, DateOnly EndDate,
    long ExpectedCents, long ActualCents, long VarianceCents, long? VarianceBasisPoints);
public sealed record BudgetBufferReport(
    DateOnly From, DateOnly Through, IReadOnlyList<BudgetBufferReportRow> Rows);
public sealed record BudgetBufferReportRow(
    Guid PeriodId, string Name, DateOnly StartDate, DateOnly EndDate, bool Open,
    long ForecastBufferTargetCents, long ActualBufferTargetCents, long FundedBufferCents,
    long BufferShortfallCents, long? FundedShareBasisPoints,
    long? DeficitCents, long? CoveredFromBufferCents, long? CarriedDeficitCents,
    string? Disposition, long? DispositionAmountCents, long? RetainedBufferCents,
    long ProtectedBufferCents, DateTime? ClosedAt);
public sealed record BudgetSavingsGoalReport(
    DateOnly From, DateOnly Through, long TotalSavedCents, long UnallocatedCents,
    IReadOnlyList<BudgetSavingsGoalReportRow> Rows);
public sealed record BudgetSavingsGoalReportRow(
    Guid PurposeId, string Name, string Status, bool Archived,
    long? TargetAmountCents, long AllocatedCents, long? ProgressBasisPoints,
    long AllocatedInRangeCents, long ConsumedInRangeCents,
    long? PlannedContributionCents, long? RevisedContributionCents,
    DateOnly? PlannedFundingDate, DateOnly? RevisedFundingDate, bool ContributionsPaused);
public sealed record BudgetInvestmentReport(
    DateOnly From, DateOnly Through,
    long ContributedCapitalCents, long CurrentValueCents, long WithdrawnCents,
    long GainCents, long GainBasisPoints, DateOnly? LatestValuationDate,
    long ContributedDeltaCents, long ValueDeltaCents,
    IReadOnlyList<InvestmentEventSummary> Events);
