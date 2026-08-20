using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static class BudgetInvestmentEndpoints
{
    public static RouteGroupBuilder MapBudgetInvestmentEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapGet("/investments", List);
        budget.MapPost("/investments/opening-values", Opening);
        budget.MapPost("/investments/contributions", Contribute);
        budget.MapPost("/investments/valuations", Value);
        budget.MapPost("/investments/withdrawals", Withdraw);
        return budget;
    }

    private static async Task<IResult> List(
        string? asOf, HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var selectedDate = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        if (!string.IsNullOrWhiteSpace(asOf) && !TryDate(asOf, out selectedDate)) return InvalidDate();
        return Results.Ok(await new BudgetInvestmentProjector(database).LoadAsync(
            user.Id, selectedDate, cancellationToken));
    }

    private static Task<IResult> Opening(
        InvestmentEventRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, BudgetService budgetService, TimeProvider timeProvider,
        CancellationToken cancellationToken) =>
        Add(request with { IdempotencyKey = null, Destination = null, TargetPurposeId = null },
            BudgetValues.Opening, context, identity, database, budgetService, timeProvider, cancellationToken);

    private static Task<IResult> Contribute(
        InvestmentEventRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, BudgetService budgetService, TimeProvider timeProvider,
        CancellationToken cancellationToken) =>
        Add(request with { Destination = null, TargetPurposeId = null },
            BudgetValues.Contribution, context, identity, database, budgetService, timeProvider, cancellationToken);

    private static Task<IResult> Value(
        InvestmentEventRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, BudgetService budgetService, TimeProvider timeProvider,
        CancellationToken cancellationToken) =>
        Add(request with { IdempotencyKey = null, Destination = null, TargetPurposeId = null },
            BudgetValues.Valuation, context, identity, database, budgetService, timeProvider, cancellationToken);

    private static Task<IResult> Withdraw(
        InvestmentEventRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, BudgetService budgetService, TimeProvider timeProvider,
        CancellationToken cancellationToken) =>
        Add(request with { Destination = string.IsNullOrWhiteSpace(request.Destination) ? BudgetValues.Buffer : request.Destination },
            BudgetValues.Withdrawal, context, identity, database, budgetService, timeProvider, cancellationToken);

    private static async Task<IResult> Add(
        InvestmentEventRequest request,
        string kind,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        BudgetService budgetService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var key = request.IdempotencyKey?.Trim();
        if (kind is BudgetValues.Contribution or BudgetValues.Withdrawal && string.IsNullOrWhiteSpace(key))
            return Invalid("Contribution and withdrawal idempotency keys are required");
        if (key?.Length > 128) return Invalid("Investment idempotency key is too long");
        if (key is not null)
        {
            var existing = await database.InvestmentEvents.AsNoTracking()
                .SingleOrDefaultAsync(x => x.OwnerUserId == user.Id && x.IdempotencyKey == key, cancellationToken);
            if (existing is not null) return Results.Ok(existing);
        }
        if (!TryDate(request.OccurredOn, out var occurredOn)) return InvalidDate();
        if (request.AmountCents < 0 || kind != BudgetValues.Valuation && request.AmountCents == 0 ||
            string.IsNullOrWhiteSpace(request.Description))
            return Invalid("Investment event needs a description and a valid exact-money amount");

        if (kind == BudgetValues.Contribution)
        {
            var summary = await budgetService.SummaryAsync(user.Id, occurredOn, cancellationToken);
            if (request.AmountCents > Math.Max(0, summary.OrdinaryAvailableCents))
                return Invalid("Investment contribution cannot exceed funded ordinary availability");
        }
        if (kind == BudgetValues.Withdrawal)
        {
            if (request.Destination is not (BudgetValues.Buffer or BudgetValues.Savings or BudgetValues.Ordinary))
                return Invalid("Withdrawal destination must be buffer, savings, or ordinary");
            if (request.Destination == BudgetValues.Savings)
            {
                if (!request.TargetPurposeId.HasValue || !await database.SavingsPurposes.AnyAsync(
                        x => x.Id == request.TargetPurposeId && x.OwnerUserId == user.Id &&
                             x.ArchivedAt == null && x.CompletedAt == null, cancellationToken))
                    return Invalid("Savings withdrawals need an active owned savings goal");
            }
            else if (request.TargetPurposeId.HasValue)
            {
                return Invalid("Only a savings withdrawal can have a target goal");
            }
            var projection = await new BudgetInvestmentProjector(database).LoadAsync(
                user.Id, occurredOn, cancellationToken);
            if (request.AmountCents > projection.CurrentValueCents)
                return Invalid("Investment withdrawal cannot exceed current investment value");
        }

        var (period, _, _) = await budgetService.EnsureDefaultsAsync(user.Id, occurredOn, cancellationToken);
        var item = new BudgetInvestmentEvent
        {
            OwnerUserId = user.Id,
            PeriodId = period.Id,
            IdempotencyKey = key,
            Kind = kind,
            OccurredOn = occurredOn,
            Description = request.Description.Trim(),
            AmountCents = request.AmountCents,
            Destination = kind == BudgetValues.Withdrawal ? request.Destination : null,
            TargetPurposeId = kind == BudgetValues.Withdrawal ? request.TargetPurposeId : null,
        };
        database.InvestmentEvents.Add(item);
        try
        {
            await database.SaveChangesAsync(cancellationToken);
            return Results.Created($"/api/v1/budget/investments/events/{item.Id}", item);
        }
        catch (DbUpdateException) when (key is not null)
        {
            database.ChangeTracker.Clear();
            var winner = await database.InvestmentEvents.AsNoTracking()
                .SingleOrDefaultAsync(x => x.OwnerUserId == user.Id && x.IdempotencyKey == key, cancellationToken);
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

public sealed record InvestmentEventRequest(
    string? IdempotencyKey,
    string? OccurredOn,
    string? Description,
    long AmountCents,
    string? Destination,
    Guid? TargetPurposeId);
