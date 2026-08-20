using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static class BudgetWishlistEndpoints
{
    public static RouteGroupBuilder MapBudgetWishlistEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapGet("/wishlist", List);
        budget.MapPost("/wishlist", Create);
        budget.MapPatch("/wishlist/{itemId:guid}", Update);
        budget.MapPost("/wishlist/{itemId:guid}/promote", Promote);
        return budget;
    }

    private static async Task<IResult> List(
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        return Results.Ok(await database.WishlistItems.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id)
            .OrderBy(x => x.Status != BudgetValues.Active)
            .ThenByDescending(x => x.Priority == BudgetValues.High)
            .ThenByDescending(x => x.Priority == BudgetValues.Medium)
            .ThenByDescending(x => x.UpdatedAt)
            .ToListAsync(cancellationToken));
    }

    private static async Task<IResult> Create(
        WishlistItemRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var error = Validate(request.Name, request.EstimatedPriceCents, request.Priority, BudgetValues.Active);
        if (error is not null) return Invalid(error);
        var item = new BudgetWishlistItem
        {
            OwnerUserId = user.Id,
            Name = request.Name!.Trim(),
            EstimatedPriceCents = request.EstimatedPriceCents,
            Priority = request.Priority!,
            Notes = request.Notes?.Trim() ?? "",
        };
        database.WishlistItems.Add(item);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/wishlist/{item.Id}", item);
    }

    private static async Task<IResult> Update(
        Guid itemId, WishlistItemUpdateRequest request, HttpContext context,
        IIdentityAccess identity, BudgetDbContext database, TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var item = await database.WishlistItems.SingleOrDefaultAsync(
            x => x.Id == itemId && x.OwnerUserId == user.Id, cancellationToken);
        if (item is null) return NotFound();
        var name = request.Name?.Trim() ?? item.Name;
        var price = request.EstimatedPriceCents ?? item.EstimatedPriceCents;
        var priority = request.Priority ?? item.Priority;
        var status = request.Status ?? item.Status;
        var error = Validate(name, price, priority, status);
        if (error is not null) return Invalid(error);
        item.Name = name;
        item.EstimatedPriceCents = price;
        item.Priority = priority;
        item.Status = status;
        if (request.Notes is not null) item.Notes = request.Notes.Trim();
        item.UpdatedAt = DateTime.SpecifyKind(timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Unspecified);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(item);
    }

    private static async Task<IResult> Promote(
        Guid itemId, WishlistPromotionRequest request, HttpContext context,
        IIdentityAccess identity, BudgetDbContext database, BudgetService budgetService,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var item = await database.WishlistItems.SingleOrDefaultAsync(
            x => x.Id == itemId && x.OwnerUserId == user.Id, cancellationToken);
        if (item is null) return NotFound();
        if (item.SavingsGoalId.HasValue) return Results.Ok(item);

        if (request.SavingsGoalId.HasValue)
        {
            if (!await database.SavingsPurposes.AnyAsync(x =>
                    x.Id == request.SavingsGoalId && x.OwnerUserId == user.Id &&
                    x.TargetAmountCents.HasValue && x.CompletedAt == null, cancellationToken))
                return Invalid("Linked savings goal was not found");
            item.SavingsGoalId = request.SavingsGoalId;
        }
        else
        {
            var target = request.TargetAmountCents ?? item.EstimatedPriceCents;
            if (target is null or <= 0 ||
                request.PlanningMode is not (BudgetValues.DateDriven or BudgetValues.RateDriven))
                return Invalid("Promotion needs a target amount and date- or rate-driven plan");
            var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
            await budgetService.EnsureDefaultsAsync(user.Id, today, cancellationToken);
            var preferredStartDay = await database.Settings.AsNoTracking()
                .Where(x => x.OwnerUserId == user.Id)
                .Select(x => (int?)x.PreferredPeriodStartDay)
                .SingleOrDefaultAsync(cancellationToken) ?? 1;
            DateOnly targetDate;
            long contribution;
            if (request.PlanningMode == BudgetValues.DateDriven)
            {
                if (!TryDate(request.TargetDate, out targetDate) || targetDate < today)
                    return Invalid("Date-driven promotion needs a current or future target date");
                contribution = BudgetSavingsGoalPlanner.DateDriven(
                    target.Value, 0, 0, today, targetDate, today, preferredStartDay)
                    .PlannedContributionCents;
            }
            else
            {
                if (request.RecurringContributionCents is null or <= 0)
                    return Invalid("Rate-driven promotion needs a positive recurring contribution");
                contribution = request.RecurringContributionCents.Value;
                targetDate = BudgetSavingsGoalPlanner.ForecastDate(
                    target.Value, 0, contribution, today, preferredStartDay);
            }
            var goal = new BudgetSavingsPurpose
            {
                Id = Guid.CreateVersion7(),
                OwnerUserId = user.Id,
                Name = item.Name,
                TargetAmountCents = target,
                PlanningMode = request.PlanningMode,
                PlanStartedOn = today,
                TargetDate = targetDate,
                RecurringContributionCents = contribution,
            };
            database.SavingsPurposes.Add(goal);
            item.SavingsGoalId = goal.Id;
        }
        item.UpdatedAt = DateTime.SpecifyKind(timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Unspecified);
        try
        {
            await database.SaveChangesAsync(cancellationToken);
            return Results.Ok(item);
        }
        catch (DbUpdateException)
        {
            return Invalid("Wishlist promotion conflicts with an existing savings goal");
        }
    }

    private static string? Validate(string? name, long? price, string? priority, string? status)
    {
        if (string.IsNullOrWhiteSpace(name)) return "Wishlist item name is required";
        if (price is <= 0) return "Estimated price must be positive";
        if (priority is not (BudgetValues.Low or BudgetValues.Medium or BudgetValues.High))
            return "Priority must be low, medium, or high";
        if (status is not (BudgetValues.Active or BudgetValues.Completed or BudgetValues.Removed))
            return "Wishlist status is invalid";
        return null;
    }

    private static bool TryDate(string? value, out DateOnly date) =>
        DateOnly.TryParseExact(value, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out date);
    private static IResult Invalid(string detail) => HttpResults.Problem(422, "Validation failed", detail);
    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
    private static IResult NotFound() => HttpResults.Problem(404, "Not found", "Wishlist item was not found");
}

public sealed record WishlistItemRequest(string? Name, long? EstimatedPriceCents, string? Priority, string? Notes);
public sealed record WishlistItemUpdateRequest(
    string? Name, long? EstimatedPriceCents, string? Priority, string? Notes, string? Status);
public sealed record WishlistPromotionRequest(
    Guid? SavingsGoalId,
    long? TargetAmountCents,
    string? PlanningMode,
    string? TargetDate,
    long? RecurringContributionCents);
