using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static class BudgetSavingsEndpoints
{
    public static RouteGroupBuilder MapBudgetSavingsEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapGet("/savings", List);
        budget.MapPost("/savings/purposes", CreatePurpose);
        budget.MapPost("/savings/contributions", Contribute);
        budget.MapPost("/savings/opening-values", Opening);
        return budget;
    }

    private static async Task<IResult> List(
        HttpContext context, IIdentityAccess identity, BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        return Results.Ok(await new BudgetSavingsProjector(database).LoadAsync(user.Id, cancellationToken));
    }

    private static async Task<IResult> CreatePurpose(
        SavingsPurposeRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var name = request.Name?.Trim() ?? "";
        if (name.Length == 0) return Invalid("Savings purpose name is required");
        var purpose = new BudgetSavingsPurpose { OwnerUserId = user.Id, Name = name };
        database.SavingsPurposes.Add(purpose);
        try
        {
            await database.SaveChangesAsync(cancellationToken);
            return Results.Created($"/api/v1/budget/savings/purposes/{purpose.Id}", purpose);
        }
        catch (DbUpdateException)
        {
            return Invalid("Savings purpose name must be unique");
        }
    }

    private static Task<IResult> Contribute(
        SavingsContributionRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, BudgetService budgetService, CancellationToken cancellationToken) =>
        AddFunding(request, BudgetValues.Contribution, context, identity, database, budgetService, cancellationToken);

    private static Task<IResult> Opening(
        SavingsContributionRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, BudgetService budgetService, CancellationToken cancellationToken) =>
        AddFunding(request with { IdempotencyKey = null }, BudgetValues.Opening, context, identity, database, budgetService, cancellationToken);

    private static async Task<IResult> AddFunding(
        SavingsContributionRequest request, string kind, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, BudgetService budgetService, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var idempotencyKey = request.IdempotencyKey?.Trim();
        if (kind == BudgetValues.Contribution && string.IsNullOrWhiteSpace(idempotencyKey))
            return Invalid("Contribution idempotency key is required");
        if (idempotencyKey?.Length > 128) return Invalid("Contribution idempotency key is too long");
        if (idempotencyKey is not null)
        {
            var existing = await database.SavingsContributions.AsNoTracking().Include(x => x.Allocations)
                .SingleOrDefaultAsync(x => x.OwnerUserId == user.Id && x.IdempotencyKey == idempotencyKey, cancellationToken);
            if (existing is not null) return Results.Ok(existing);
        }
        if (!TryDate(request.OccurredOn, out var occurredOn)) return InvalidDate();
        if (request.AmountCents <= 0 || string.IsNullOrWhiteSpace(request.Description))
            return Invalid("Savings funding needs a description and positive amount");
        var allocations = request.Allocations ?? [];
        if (allocations.Select(x => x.PurposeId).Distinct().Count() != allocations.Count)
            return Invalid("Each savings purpose can be allocated only once per contribution");
        if (allocations.Any(x => x.Mode is not ("fixed" or "percentage") || x.Value < 0 ||
                                 x.Mode == "percentage" && x.Value > 10_000))
            return Invalid("Savings allocation is invalid");
        var purposeIds = allocations.Select(x => x.PurposeId).ToHashSet();
        var foundPurposes = await database.SavingsPurposes.AsNoTracking().Where(
            x => x.OwnerUserId == user.Id && purposeIds.Contains(x.Id) && x.ArchivedAt == null)
            .Select(x => x.Id).ToListAsync(cancellationToken);
        if (foundPurposes.Count != purposeIds.Count) return Invalid("Savings purpose was not found");

        var calculated = allocations.Select(x => new
        {
            Request = x,
            Amount = x.Mode == "fixed"
                ? x.Value
                : checked((long)Math.Floor((decimal)request.AmountCents * x.Value / 10_000m)),
        }).ToList();
        var allocatedTotal = calculated.Sum(x => x.Amount);
        if (allocatedTotal > request.AmountCents)
            return Invalid("Savings allocations cannot exceed funded value");
        var (period, _, _) = await budgetService.EnsureDefaultsAsync(user.Id, occurredOn, cancellationToken);
        if (kind == BudgetValues.Contribution)
        {
            var summary = await budgetService.SummaryAsync(user.Id, occurredOn, cancellationToken);
            if (request.AmountCents > Math.Max(0, summary.OrdinaryAvailableCents))
                return Invalid("Savings contribution cannot exceed funded ordinary availability");
        }

        var contribution = new BudgetSavingsContribution
        {
            OwnerUserId = user.Id,
            PeriodId = period.Id,
            IdempotencyKey = idempotencyKey,
            Kind = kind,
            OccurredOn = occurredOn,
            Description = request.Description.Trim(),
            AmountCents = request.AmountCents,
            UnallocatedCents = request.AmountCents - allocatedTotal,
        };
        contribution.Allocations.AddRange(calculated.Select(x => new BudgetSavingsAllocation
        {
            OwnerUserId = user.Id,
            PurposeId = x.Request.PurposeId,
            Mode = x.Request.Mode!,
            RequestedValue = x.Request.Value,
            AmountCents = x.Amount,
        }));
        database.SavingsContributions.Add(contribution);
        try
        {
            await database.SaveChangesAsync(cancellationToken);
            return Results.Created($"/api/v1/budget/savings/contributions/{contribution.Id}", contribution);
        }
        catch (DbUpdateException) when (idempotencyKey is not null)
        {
            database.ChangeTracker.Clear();
            var winner = await database.SavingsContributions.AsNoTracking().Include(x => x.Allocations)
                .SingleOrDefaultAsync(x => x.OwnerUserId == user.Id && x.IdempotencyKey == idempotencyKey, cancellationToken);
            if (winner is not null) return Results.Ok(winner);
            throw;
        }
    }

    private static bool TryDate(string? value, out DateOnly date) =>
        DateOnly.TryParseExact(value, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out date);
    private static IResult InvalidDate() => HttpResults.Problem(400, "Invalid date", "occurredOn must use YYYY-MM-DD");
    private static IResult Invalid(string detail) => HttpResults.Problem(422, "Validation failed", detail);
    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
}

public sealed record SavingsPurposeRequest(string? Name);
public sealed record SavingsContributionRequest(
    string? IdempotencyKey,
    string? OccurredOn,
    string? Description,
    long AmountCents,
    IReadOnlyList<SavingsAllocationRequest>? Allocations);
public sealed record SavingsAllocationRequest(Guid PurposeId, string? Mode, long Value);
