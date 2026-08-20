using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static class BudgetPeriodCloseEndpoints
{
    public static RouteGroupBuilder MapBudgetPeriodCloseEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapPost("/periods/{periodId:guid}/close", Close);
        return budget;
    }

    private static async Task<IResult> Close(
        Guid periodId,
        PeriodCloseRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        BudgetService budgetService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
        var existing = await database.PeriodCloses.AsNoTracking().SingleOrDefaultAsync(
            x => x.OwnerUserId == user.Id && x.PeriodId == periodId, cancellationToken);
        if (existing is not null) return Results.Ok(existing);
        var period = await database.Periods.AsNoTracking().SingleOrDefaultAsync(
            x => x.OwnerUserId == user.Id && x.Id == periodId, cancellationToken);
        if (period is null) return HttpResults.Problem(404, "Not found", "Budget period was not found");
        if (request.CoverDeficitCents < 0)
            return HttpResults.Problem(422, "Validation failed", "Deficit coverage must not be negative");
        var settings = await database.Settings.AsNoTracking().SingleOrDefaultAsync(
            x => x.OwnerUserId == user.Id, cancellationToken);
        var disposition = request.Disposition ?? settings?.DefaultBufferDisposition ?? BudgetValues.Retain;
        if (disposition is not ("retain" or "ordinary" or "savings" or "investment"))
            return HttpResults.Problem(422, "Validation failed", "Buffer disposition is invalid");

        var summary = await budgetService.SummaryAsync(user.Id, period.StartDate, cancellationToken);
        var deficit = Math.Max(0, -summary.OrdinaryAvailableCents);
        var maximumCoverage = Math.Min(deficit, summary.ProtectedBufferCents);
        if (request.CoverDeficitCents > maximumCoverage)
            return HttpResults.Problem(
                422,
                "Validation failed",
                $"Deficit coverage cannot exceed {maximumCoverage} cents");
        var remainingBuffer = summary.ProtectedBufferCents - request.CoverDeficitCents;
        var dispositionAmount = disposition == BudgetValues.Retain ? 0 : remainingBuffer;
        var close = new BudgetPeriodClose
        {
            OwnerUserId = user.Id,
            PeriodId = period.Id,
            ForecastBufferTargetCents = summary.ForecastBufferTargetCents,
            ActualBufferTargetCents = summary.ActualBufferTargetCents,
            FundedBufferCents = summary.FundedBufferCents,
            BufferShortfallCents = summary.BufferShortfallCents,
            DeficitCents = deficit,
            CoveredFromBufferCents = request.CoverDeficitCents,
            CarriedDeficitCents = deficit - request.CoverDeficitCents,
            Disposition = disposition,
            DispositionAmountCents = dispositionAmount,
            RetainedBufferCents = disposition == BudgetValues.Retain ? remainingBuffer : 0,
            ClosedAt = DateTime.SpecifyKind(timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Unspecified),
        };
        database.PeriodCloses.Add(close);
        try
        {
            await database.SaveChangesAsync(cancellationToken);
            return Results.Created($"/api/v1/budget/periods/{period.Id}/close", close);
        }
        catch (DbUpdateException)
        {
            database.ChangeTracker.Clear();
            var winner = await database.PeriodCloses.AsNoTracking().SingleOrDefaultAsync(
                x => x.OwnerUserId == user.Id && x.PeriodId == periodId, cancellationToken);
            if (winner is not null) return Results.Ok(winner);
            throw;
        }
    }
}

public sealed record PeriodCloseRequest(long CoverDeficitCents, string? Disposition);
