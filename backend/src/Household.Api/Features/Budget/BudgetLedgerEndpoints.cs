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
