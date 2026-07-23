using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static class BudgetLedgerEndpoints
{
    public static RouteGroupBuilder MapBudgetLedgerEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapGet("/ledger/entries", ListEntries);
        budget.MapPost("/ledger/entries", PostEntry);
        budget.MapGet("/merchants/suggestions", MerchantSuggestions);
        budget.MapGet("/timeline", Timeline);
        budget.MapGet("/ledger/entries/{entryId:guid}", EntryDetails);
        budget.MapPost("/ledger/entries/{entryId:guid}/corrections", CorrectEntry);
        budget.MapPost("/ledger/entries/{entryId:guid}/voids", VoidEntry);
        budget.MapPost("/ledger/entries/{entryId:guid}/refunds", RefundEntry);
        budget.MapGet("/migration-issues", ListMigrationIssues);
        return budget;
    }

    private static async Task<IResult> ListEntries(
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        return Results.Ok(await database.LedgerEntries.AsNoTracking()
            .Include(x => x.Splits)
            .Where(x => x.OwnerUserId == user.Id)
            .OrderByDescending(x => x.OccurredOn).ThenByDescending(x => x.CreatedAt)
            .Take(500).ToListAsync(cancellationToken));
    }

    private static async Task<IResult> PostEntry(
        LedgerEntryRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        BudgetService budgetService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (request.Kind is not (BudgetValues.Income or BudgetValues.Expense))
            return Invalid("Kind must be income or expense");
        if (request.AmountCents <= 0 || string.IsNullOrWhiteSpace(request.Description))
            return Invalid("Description and a positive exact-money amount are required");
        var occurredOn = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        if (!string.IsNullOrWhiteSpace(request.OccurredOn) && !DateOnly.TryParseExact(
                request.OccurredOn, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out occurredOn))
            return HttpResults.Problem(400, "Invalid date", "Occurred date must use YYYY-MM-DD");
        if (request.CategoryId.HasValue && !await database.Categories.AnyAsync(
                x => x.Id == request.CategoryId && x.OwnerUserId == user.Id && x.ArchivedAt == null, cancellationToken))
            return HttpResults.Problem(404, "Not found", "Category was not found");

        var splitRequests = request.Splits ?? [];
        if (request.Kind == BudgetValues.Income && splitRequests.Count > 0)
            return Invalid("Income entries cannot have expense category splits");
        if (splitRequests.Select(x => x.CategoryId).Distinct().Count() != splitRequests.Count)
            return Invalid("A category can appear only once in a transaction split");
        IReadOnlyList<SplitAllocation> allocations;
        try
        {
            allocations = request.Kind == BudgetValues.Expense
                ? BudgetSplitAllocator.Allocate(request.AmountCents,
                    splitRequests.Count > 0
                        ? splitRequests.Select(x => new SplitAllocationInput(x.AmountCents, x.UseRemaining, x.AffectsOrdinary)).ToList()
                        : [new SplitAllocationInput(request.AmountCents, false, request.AffectsOrdinary != false)])
                : [];
        }
        catch (ArgumentException error)
        {
            return Invalid(error.Message);
        }

        var categoryIds = (splitRequests.Count > 0
                ? splitRequests.Select(x => x.CategoryId)
                : request.CategoryId.HasValue ? [request.CategoryId.Value] : [])
            .ToHashSet();
        var categories = await database.Categories.Where(x =>
                categoryIds.Contains(x.Id) && x.OwnerUserId == user.Id && x.ArchivedAt == null)
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        if (categories.Count != categoryIds.Count) return HttpResults.Problem(404, "Not found", "A split category was not found or is archived");
        var versions = await database.CategoryVersions.Where(x => categoryIds.Contains(x.CategoryId) && x.OwnerUserId == user.Id)
            .OrderByDescending(x => x.EffectiveFrom).ToListAsync(cancellationToken);
        var latestVersions = versions.GroupBy(x => x.CategoryId).ToDictionary(x => x.Key, x => x.First());

        var (period, _, _) = await budgetService.EnsureDefaultsAsync(user.Id, occurredOn, cancellationToken);
        var merchant = MerchantPresentation.From(request.Merchant);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var entry = new BudgetLedgerEntry
        {
            OwnerUserId = user.Id,
            PeriodId = period.Id,
            CategoryId = request.Kind == BudgetValues.Expense && categoryIds.Count == 1 ? categoryIds.Single() : null,
            Kind = request.Kind,
            OccurredOn = occurredOn,
            Description = request.Description.Trim(),
            AmountCents = request.AmountCents,
            OrdinaryImpactCents = request.Kind == BudgetValues.Income ? request.AmountCents : allocations.Sum(x => x.OrdinaryImpactCents),
            Source = "manual",
            MerchantRaw = merchant.Raw,
            MerchantNormalized = merchant.Normalized,
            MerchantBrandKey = merchant.BrandKey,
        };
        database.LedgerEntries.Add(entry);
        await database.SaveChangesAsync(cancellationToken);
        if (request.Kind == BudgetValues.Expense)
        {
            for (var index = 0; index < allocations.Count; index++)
            {
                var splitRequest = splitRequests.Count > 0 ? splitRequests[index] : null;
                var categoryId = splitRequest?.CategoryId ?? request.CategoryId;
                var category = categoryId.HasValue ? categories.GetValueOrDefault(categoryId.Value) : null;
                var version = categoryId.HasValue ? latestVersions.GetValueOrDefault(categoryId.Value) : null;
                var allocation = allocations[index];
                database.LedgerSplits.Add(new BudgetLedgerSplit
                {
                    OwnerUserId = user.Id,
                    LedgerEntryId = entry.Id,
                    CategoryId = categoryId,
                    CategoryVersionId = version?.Id,
                    CategoryNameSnapshot = version?.Name ?? category?.Name ?? "Uncategorized",
                    CategoryColorSnapshot = version?.Color ?? category?.Color ?? "#64748b",
                    CategoryIconSnapshot = version?.Icon ?? category?.Icon ?? "tag",
                    AmountCents = allocation.AmountCents,
                    OrdinaryImpactCents = allocation.OrdinaryImpactCents,
                });
            }
            await database.SaveChangesAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        await database.Entry(entry).Collection(x => x.Splits).LoadAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/ledger/entries/{entry.Id}", entry);
    }

    private static async Task<IResult> MerchantSuggestions(
        string? query,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var normalizedQuery = MerchantPresentation.From(query).Normalized;
        var history = await database.LedgerEntries.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.MerchantNormalized != "" &&
                (normalizedQuery == "" || x.MerchantNormalized.Contains(normalizedQuery)))
            .GroupBy(x => new { x.MerchantNormalized, x.MerchantBrandKey })
            .Select(x => new { normalized = x.Key.MerchantNormalized, brandKey = x.Key.MerchantBrandKey, count = x.Count() })
            .OrderByDescending(x => x.count).Take(10).ToListAsync(cancellationToken);
        var merchants = MerchantPresentation.Known(normalizedQuery)
            .Select(x => new { normalized = x.Normalized, displayName = x.DisplayName, brandKey = x.BrandKey, count = 0 })
            .Concat(history.Select(x => new { x.normalized, displayName = x.normalized, x.brandKey, x.count }))
            .GroupBy(x => x.normalized).Select(x => x.OrderByDescending(item => item.count).First()).Take(10).ToList();
        var matched = merchants.Select(x => x.normalized).ToHashSet();
        var categorySuggestions = await database.LedgerSplits.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.CategoryId != null &&
                database.LedgerEntries.Any(entry => entry.Id == x.LedgerEntryId && matched.Contains(entry.MerchantNormalized)))
            .GroupBy(x => x.CategoryId!.Value).Select(x => new { categoryId = x.Key, count = x.Count() })
            .OrderByDescending(x => x.count).Take(3).ToListAsync(cancellationToken);
        return Results.Ok(new { merchants, categorySuggestions });
    }

    private static async Task<IResult> Timeline(
        string? query,
        Guid? periodId,
        Guid? categoryId,
        string? status,
        string? kind,
        string? origin,
        string? impact,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        BudgetService budgetService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var entries = await database.LedgerEntries.AsNoTracking().Include(x => x.Splits)
            .Where(x => x.OwnerUserId == user.Id && (!periodId.HasValue || x.PeriodId == periodId))
            .OrderByDescending(x => x.OccurredOn).ThenByDescending(x => x.CreatedAt).Take(500).ToListAsync(cancellationToken);
        var actions = await database.LedgerActions.AsNoTracking().Where(x => x.OwnerUserId == user.Id)
            .OrderBy(x => x.CreatedAt).ToListAsync(cancellationToken);
        var voided = actions.Where(x => x.Kind == BudgetValues.Void).Select(x => x.LedgerEntryId).ToHashSet();
        var superseded = (await database.LedgerEntries.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.CorrectsEntryId.HasValue)
            .Select(x => x.CorrectsEntryId!.Value).ToListAsync(cancellationToken)).ToHashSet();
        var actual = entries.Select(entry => new BudgetTimelineItem(
            entry.Id.ToString(), "actual", entry.Kind, voided.Contains(entry.Id) ? "voided" : superseded.Contains(entry.Id) ? "corrected" : "actual",
            entry.OccurredOn, entry.Description, entry.AmountCents, entry.OrdinaryImpactCents, entry.CategoryId,
            entry.MerchantNormalized, entry.MerchantBrandKey, entry.Source, entry.Splits)).ToList();

        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        var (currentPeriod, _, _) = await budgetService.EnsureDefaultsAsync(user.Id, today, cancellationToken);
        var projectedPeriod = !periodId.HasValue || periodId == currentPeriod.Id
            ? currentPeriod
            : await database.Periods.AsNoTracking().SingleOrDefaultAsync(
                x => x.OwnerUserId == user.Id && x.Id == periodId, cancellationToken);
        var applied = (await database.PlannedExpenseApplications.AsNoTracking().Where(x => x.OwnerUserId == user.Id && x.PeriodId == currentPeriod.Id)
            .Select(x => x.PlannedExpenseId).ToListAsync(cancellationToken)).ToHashSet();
        var plans = await database.PlannedExpenses.AsNoTracking().Where(x => x.OwnerUserId == user.Id && x.Active).ToListAsync(cancellationToken);
        var migratedCommitmentIds = (await database.CommitmentPlans.AsNoTracking().Where(x => x.OwnerUserId == user.Id)
            .Select(x => x.SeriesId).Distinct().ToListAsync(cancellationToken)).ToHashSet();
        var expectedExpenses = periodId.HasValue && periodId != currentPeriod.Id
            ? []
            : plans.Where(x => !applied.Contains(x.Id) && !migratedCommitmentIds.Contains(x.Id)).Select(plan => (Plan: plan, Date: BudgetService.OccurrenceDate(currentPeriod, plan)))
                .Where(x => x.Date.HasValue)
                .Select(x => new BudgetTimelineItem(
                    $"expected:{x.Plan.Id}:{currentPeriod.Id}", "expected", BudgetValues.Expense, "expected", x.Date!.Value,
                    x.Plan.Name, x.Plan.AmountCents, x.Plan.IncludeInLimit ? -x.Plan.AmountCents : 0, x.Plan.CategoryId,
                "", null, "planned_expense", [])).ToList();
        var expectedIncome = projectedPeriod is null
            ? []
            : (await new BudgetIncomePlanProjector(database).LoadAsync(
                    user.Id, projectedPeriod.StartDate, projectedPeriod.EndDate, cancellationToken))
                .Occurrences.Select(x => new BudgetTimelineItem(
                    x.Id, "expected", BudgetValues.Income, x.Status, x.OccurredOn,
                    x.Name, x.AmountCents, x.AmountCents, null, "", null, "income_plan", [])).ToList();
        var expectedCommitments = projectedPeriod is null
            ? []
            : (await new BudgetCommitmentProjector(database).LoadAsync(
                    user.Id, projectedPeriod.StartDate, projectedPeriod.EndDate, cancellationToken))
                .Occurrences.Select(x => new BudgetTimelineItem(
                    x.Id, "expected", BudgetValues.Expense, x.Status, x.OccurredOn,
                    x.Name, x.AmountCents, -x.AmountCents, x.CategoryId, "", null, "commitment_plan", [])).ToList();
        var result = actual.Concat(expectedExpenses).Concat(expectedIncome).Concat(expectedCommitments).Where(item =>
                (string.IsNullOrWhiteSpace(query) || item.Description.Contains(query, StringComparison.OrdinalIgnoreCase) || item.Merchant.Contains(query, StringComparison.OrdinalIgnoreCase)) &&
                (string.IsNullOrWhiteSpace(status) || item.Status == status) &&
                (string.IsNullOrWhiteSpace(kind) || item.Kind == kind) &&
                (string.IsNullOrWhiteSpace(origin) || item.Origin == origin) &&
                (!categoryId.HasValue || item.CategoryId == categoryId || item.Splits.Any(x => x.CategoryId == categoryId)) &&
                (string.IsNullOrWhiteSpace(impact) || impact == "included" && item.OrdinaryImpactCents != 0 || impact == "excluded" && item.OrdinaryImpactCents == 0))
            .OrderByDescending(x => x.OccurredOn).ThenByDescending(x => x.EntryType).ToList();
        return Results.Ok(result);
    }

    private static async Task<IResult> EntryDetails(
        Guid entryId,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var entry = await database.LedgerEntries.AsNoTracking().Include(x => x.Splits)
            .SingleOrDefaultAsync(x => x.Id == entryId && x.OwnerUserId == user.Id, cancellationToken);
        if (entry is null) return HttpResults.Problem(404, "Not found", "Ledger entry was not found");
        var actions = await database.LedgerActions.AsNoTracking().Where(x => x.OwnerUserId == user.Id && x.LedgerEntryId == entryId)
            .OrderBy(x => x.CreatedAt).ToListAsync(cancellationToken);
        var corrections = await database.LedgerEntries.AsNoTracking().Where(x => x.OwnerUserId == user.Id && x.CorrectsEntryId == entryId)
            .Select(x => new { x.Id, x.ChangeReason, x.CreatedAt }).ToListAsync(cancellationToken);
        return Results.Ok(new { entry, auditHistory = new { createdAt = entry.CreatedAt, actions, corrections } });
    }

    private static async Task<IResult> CorrectEntry(
        Guid entryId,
        CorrectionRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        BudgetService budgetService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Reason)) return Invalid("A correction reason is required");
        var original = await EffectiveExpenseOrIncome(entryId, user.Id, database, cancellationToken);
        if (original.Error is not null) return original.Error;
        if (request.AmountCents <= 0 || string.IsNullOrWhiteSpace(request.Description)) return Invalid("Description and positive amount are required");
        if (!DateOnly.TryParseExact(request.OccurredOn, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out var occurredOn))
            return HttpResults.Problem(400, "Invalid date", "Occurred date must use YYYY-MM-DD");
        if (original.Entry!.Kind == BudgetValues.Expense && request.CategoryId.HasValue &&
            !await database.Categories.AnyAsync(
                x => x.Id == request.CategoryId && x.OwnerUserId == user.Id && x.ArchivedAt == null,
                cancellationToken))
            return HttpResults.Problem(404, "Not found", "Category was not found or is archived");
        var (period, _, _) = await budgetService.EnsureDefaultsAsync(user.Id, occurredOn, cancellationToken);
        var merchant = MerchantPresentation.From(request.Merchant);
        var corrected = new BudgetLedgerEntry
        {
            OwnerUserId = user.Id, PeriodId = period.Id, CategoryId = request.CategoryId,
            Kind = original.Entry.Kind, OccurredOn = occurredOn, Description = request.Description.Trim(), AmountCents = request.AmountCents,
            OrdinaryImpactCents = original.Entry.Kind == BudgetValues.Income ? request.AmountCents : request.AffectsOrdinary ? -request.AmountCents : 0,
            Source = "correction", CorrectsEntryId = original.Entry.Id, ChangeReason = request.Reason.Trim(),
            MerchantRaw = merchant.Raw, MerchantNormalized = merchant.Normalized, MerchantBrandKey = merchant.BrandKey,
        };
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        database.LedgerEntries.Add(corrected);
        await database.SaveChangesAsync(cancellationToken);
        if (corrected.Kind == BudgetValues.Expense)
            await AddSingleSplit(corrected, request.CategoryId, request.AffectsOrdinary, user.Id, database, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await database.Entry(corrected).Collection(x => x.Splits).LoadAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/ledger/entries/{corrected.Id}", corrected);
    }

    private static async Task<IResult> VoidEntry(
        Guid entryId,
        ReasonRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Reason)) return Invalid("A void reason is required");
        var original = await EffectiveExpenseOrIncome(entryId, user.Id, database, cancellationToken);
        if (original.Error is not null) return original.Error;
        if (await database.LedgerEntries.AnyAsync(
                x => x.OwnerUserId == user.Id && x.Kind == BudgetValues.Refund && x.RelatedEntryId == entryId,
                cancellationToken))
            return HttpResults.Problem(409, "Invalid state", "An expense with refunds cannot be voided");
        database.LedgerActions.Add(new BudgetLedgerAction
        {
            OwnerUserId = user.Id, LedgerEntryId = entryId, Kind = BudgetValues.Void, Reason = request.Reason.Trim(),
        });
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> RefundEntry(
        Guid entryId,
        RefundRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        BudgetService budgetService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var originalResult = await EffectiveExpenseOrIncome(entryId, user.Id, database, cancellationToken);
        if (originalResult.Error is not null) return originalResult.Error;
        var original = originalResult.Entry!;
        if (original.Kind != BudgetValues.Expense) return Invalid("Only an expense can be refunded");
        var alreadyRefunded = await database.LedgerEntries.Where(x => x.OwnerUserId == user.Id && x.Kind == BudgetValues.Refund && x.RelatedEntryId == entryId)
            .SumAsync(x => (long?)x.AmountCents, cancellationToken) ?? 0;
        if (request.AmountCents <= 0 || checked(alreadyRefunded + request.AmountCents) > original.AmountCents)
            return Invalid("Refund amount exceeds the remaining original expense");
        if (!DateOnly.TryParseExact(request.OccurredOn, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out var occurredOn))
            return HttpResults.Problem(400, "Invalid date", "Occurred date must use YYYY-MM-DD");
        var (period, _, _) = await budgetService.EnsureDefaultsAsync(user.Id, occurredOn, cancellationToken);
        var refund = new BudgetLedgerEntry
        {
            OwnerUserId = user.Id, PeriodId = period.Id, Kind = BudgetValues.Refund, OccurredOn = occurredOn,
            Description = string.IsNullOrWhiteSpace(request.Description) ? $"Refund: {original.Description}" : request.Description.Trim(),
            AmountCents = request.AmountCents,
            OrdinaryImpactCents = BudgetLedgerState.RefundImpact(original.OrdinaryImpactCents, original.AmountCents, request.AmountCents),
            Source = "refund", RelatedEntryId = original.Id, MerchantRaw = original.MerchantRaw,
            MerchantNormalized = original.MerchantNormalized, MerchantBrandKey = original.MerchantBrandKey,
        };
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        database.LedgerEntries.Add(refund);
        await database.SaveChangesAsync(cancellationToken);
        var allocated = 0L;
        for (var index = 0; index < original.Splits.Count; index++)
        {
            var source = original.Splits[index];
            var amount = index == original.Splits.Count - 1
                ? request.AmountCents - allocated
                : checked(source.AmountCents * request.AmountCents / original.AmountCents);
            if (amount <= 0) continue;
            allocated += amount;
            database.LedgerSplits.Add(new BudgetLedgerSplit
            {
                OwnerUserId = user.Id, LedgerEntryId = refund.Id, CategoryId = source.CategoryId, CategoryVersionId = source.CategoryVersionId,
                CategoryNameSnapshot = source.CategoryNameSnapshot, CategoryColorSnapshot = source.CategoryColorSnapshot,
                CategoryIconSnapshot = source.CategoryIconSnapshot, AmountCents = amount,
                OrdinaryImpactCents = BudgetLedgerState.RefundImpact(source.OrdinaryImpactCents, source.AmountCents, amount),
            });
        }
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await database.Entry(refund).Collection(x => x.Splits).LoadAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/ledger/entries/{refund.Id}", refund);
    }

    private static async Task<(BudgetLedgerEntry? Entry, IResult? Error)> EffectiveExpenseOrIncome(
        Guid id, Guid ownerId, BudgetDbContext database, CancellationToken cancellationToken)
    {
        var entry = await database.LedgerEntries.Include(x => x.Splits)
            .SingleOrDefaultAsync(x => x.Id == id && x.OwnerUserId == ownerId, cancellationToken);
        if (entry is null) return (null, HttpResults.Problem(404, "Not found", "Ledger entry was not found"));
        if (entry.Kind == BudgetValues.Refund) return (null, HttpResults.Problem(409, "Invalid state", "Refunds cannot be corrected, voided, or refunded here"));
        if (await database.LedgerEntries.AnyAsync(x => x.OwnerUserId == ownerId && x.CorrectsEntryId == id, cancellationToken) ||
            await database.LedgerActions.AnyAsync(x => x.OwnerUserId == ownerId && x.LedgerEntryId == id && x.Kind == BudgetValues.Void, cancellationToken))
            return (null, HttpResults.Problem(409, "Invalid state", "Ledger entry is no longer the effective version"));
        return (entry, null);
    }

    private static async Task AddSingleSplit(
        BudgetLedgerEntry entry, Guid? categoryId, bool affectsOrdinary, Guid ownerId, BudgetDbContext database, CancellationToken cancellationToken)
    {
        var category = categoryId.HasValue ? await database.Categories.SingleOrDefaultAsync(
            x => x.Id == categoryId && x.OwnerUserId == ownerId && x.ArchivedAt == null, cancellationToken) : null;
        if (categoryId.HasValue && category is null) throw new InvalidOperationException("Category was not found or is archived");
        var version = categoryId.HasValue ? await database.CategoryVersions.Where(x => x.OwnerUserId == ownerId && x.CategoryId == categoryId)
            .OrderByDescending(x => x.EffectiveFrom).FirstOrDefaultAsync(cancellationToken) : null;
        database.LedgerSplits.Add(new BudgetLedgerSplit
        {
            OwnerUserId = ownerId, LedgerEntryId = entry.Id, CategoryId = categoryId, CategoryVersionId = version?.Id,
            CategoryNameSnapshot = version?.Name ?? category?.Name ?? "Uncategorized",
            CategoryColorSnapshot = version?.Color ?? category?.Color ?? "#64748b",
            CategoryIconSnapshot = version?.Icon ?? category?.Icon ?? "tag", AmountCents = entry.AmountCents,
            OrdinaryImpactCents = affectsOrdinary ? -entry.AmountCents : 0,
        });
        await database.SaveChangesAsync(cancellationToken);
    }

    private static async Task<IResult> ListMigrationIssues(
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        return Results.Ok(await database.MigrationIssues.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id)
            .OrderBy(x => x.CreatedAt).ToListAsync(cancellationToken));
    }

    private static IResult Invalid(string detail) => HttpResults.Problem(422, "Validation failed", detail);
    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
}

public sealed record LedgerEntryRequest(
    string Kind,
    string? OccurredOn,
    string Description,
    long AmountCents,
    Guid? CategoryId,
    bool? AffectsOrdinary,
    string? Merchant,
    IReadOnlyList<LedgerSplitRequest>? Splits);

public sealed record LedgerSplitRequest(Guid CategoryId, long? AmountCents, bool UseRemaining, bool AffectsOrdinary);
public sealed record CorrectionRequest(
    string Reason, string Description, string OccurredOn, long AmountCents, Guid? CategoryId, bool AffectsOrdinary, string? Merchant);
public sealed record ReasonRequest(string Reason);
public sealed record RefundRequest(string OccurredOn, long AmountCents, string? Description);
public sealed record BudgetTimelineItem(
    string Id,
    string EntryType,
    string Kind,
    string Status,
    DateOnly OccurredOn,
    string Description,
    long AmountCents,
    long OrdinaryImpactCents,
    Guid? CategoryId,
    string Merchant,
    string? MerchantBrandKey,
    string Origin,
    IReadOnlyList<BudgetLedgerSplit> Splits);
