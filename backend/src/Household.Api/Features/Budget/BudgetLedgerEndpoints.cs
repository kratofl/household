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
                x => x.Id == request.CategoryId && x.OwnerUserId == user.Id, cancellationToken))
            return HttpResults.Problem(404, "Not found", "Category was not found");

        var (period, _, _) = await budgetService.EnsureDefaultsAsync(user.Id, occurredOn, cancellationToken);
        var entry = new BudgetLedgerEntry
        {
            OwnerUserId = user.Id,
            PeriodId = period.Id,
            CategoryId = request.Kind == BudgetValues.Expense ? request.CategoryId : null,
            Kind = request.Kind,
            OccurredOn = occurredOn,
            Description = request.Description.Trim(),
            AmountCents = request.AmountCents,
            OrdinaryImpactCents = request.Kind == BudgetValues.Income
                ? request.AmountCents
                : request.AffectsOrdinary == false ? 0 : -request.AmountCents,
            Source = "manual",
        };
        database.LedgerEntries.Add(entry);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/ledger/entries/{entry.Id}", entry);
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
    bool? AffectsOrdinary);
