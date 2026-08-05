using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static class BudgetIncomePostingEndpoints
{
    public static RouteGroupBuilder MapBudgetIncomePostingEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapPost("/income-plans/{seriesId:guid}/occurrences/{scheduledOn}/confirm", Confirm);
        budget.MapPost("/income-plans/auto-post", AutoPost);
        budget.MapGet("/income-variance-rules", ListRules);
        budget.MapPut("/income-variance-rules/default", SaveDefaultRule);
        budget.MapPut("/income-plans/{seriesId:guid}/variance-rule", SavePlanRule);
        return budget;
    }

    private static async Task<IResult> Confirm(
        Guid seriesId, string scheduledOn, ConfirmIncomeRequest request,
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (!TryDate(scheduledOn, out var scheduled)) return InvalidDate("scheduledOn");
        if (!TryDate(request.ActualOn, out var actualOn)) return InvalidDate("actualOn");
        if (request.ActualAmountCents <= 0) return Invalid("Actual income amount must be positive");
        var projection = await new BudgetIncomePlanProjector(database).LoadAsync(user.Id, scheduled, scheduled, cancellationToken);
        var occurrence = projection.Occurrences.SingleOrDefault(x => x.SeriesId == seriesId && x.ScheduledOn == scheduled);
        if (occurrence is null) return HttpResults.Problem(404, "Not found", "Expected income occurrence was not found");
        var routing = ParseRule(request.Routing);
        if (routing.Error is not null) return routing.Error;
        var service = new BudgetIncomePostingService(database, new BudgetService(database, timeProvider));
        try
        {
            var result = await service.ConfirmAsync(
                user.Id, occurrence, actualOn, request.ActualAmountCents, BudgetValues.Manual,
                routing.Value, cancellationToken);
            return result.AlreadyPosted ? Results.Ok(result.Posting) : Results.Created(
                $"/api/v1/budget/ledger/entries/{result.Posting.LedgerEntryId}", result.Posting);
        }
        catch (ArgumentException exception)
        {
            return Invalid(exception.Message);
        }
    }

    private static async Task<IResult> AutoPost(
        string? from, string? through, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, BudgetService budgetService, TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var end = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        if (!string.IsNullOrWhiteSpace(through) && !TryDate(through, out end)) return InvalidDate("through");
        var start = end.AddYears(-1);
        if (!string.IsNullOrWhiteSpace(from) && !TryDate(from, out start)) return InvalidDate("from");
        IncomePlanProjection projection;
        try { projection = await new BudgetIncomePlanProjector(database).LoadAsync(user.Id, start, end, cancellationToken); }
        catch (ArgumentOutOfRangeException exception) { return Invalid(exception.Message); }
        var automaticVersions = projection.Plans.SelectMany(x => x.Versions).Where(x => x.AutomaticPosting).Select(x => x.Id).ToHashSet();
        var service = new BudgetIncomePostingService(database, budgetService);
        var posted = 0;
        var alreadyPosted = 0;
        foreach (var occurrence in projection.Occurrences.Where(
                     x => x.OccurredOn <= end && automaticVersions.Contains(x.VersionId)))
        {
            if (occurrence.Status != "expected")
            {
                alreadyPosted++;
                continue;
            }
            var result = await service.ConfirmAsync(
                user.Id, occurrence, occurrence.OccurredOn, occurrence.AmountCents,
                BudgetValues.Automatic, null, cancellationToken);
            if (result.AlreadyPosted) alreadyPosted++; else posted++;
        }
        return Results.Ok(new { posted, alreadyPosted });
    }

    private static async Task<IResult> ListRules(
        HttpContext context, IIdentityAccess identity, BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var rules = await database.IncomeVarianceRules.AsNoTracking().Include(x => x.Routes)
            .Where(x => x.OwnerUserId == user.Id)
            .OrderBy(x => x.SeriesId).ThenByDescending(x => x.EffectiveFrom).ToListAsync(cancellationToken);
        var latest = rules.GroupBy(x => x.SeriesId).Select(x => x.First()).ToList();
        return Results.Ok(latest);
    }

    private static Task<IResult> SaveDefaultRule(
        VarianceRuleRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, TimeProvider timeProvider, CancellationToken cancellationToken) =>
        SaveRule(null, request, context, identity, database, timeProvider, cancellationToken);

    private static async Task<IResult> SavePlanRule(
        Guid seriesId, VarianceRuleRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (!await database.IncomePlans.AnyAsync(x => x.OwnerUserId == user.Id && x.SeriesId == seriesId, cancellationToken))
            return HttpResults.Problem(404, "Not found", "Income plan was not found");
        return await SaveRule(seriesId, request, context, identity, database, timeProvider, cancellationToken, user.Id);
    }

    private static async Task<IResult> SaveRule(
        Guid? seriesId, VarianceRuleRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, TimeProvider timeProvider, CancellationToken cancellationToken, Guid? knownOwnerId = null)
    {
        var ownerId = knownOwnerId;
        if (!ownerId.HasValue)
        {
            var user = await identity.CurrentUserAsync(context, cancellationToken);
            if (user is null) return Unauthorized();
            ownerId = user.Id;
        }
        var parsed = ParseRule(request);
        if (parsed.Error is not null || parsed.Value is null) return parsed.Error!;
        var rule = new BudgetIncomeVarianceRule
        {
            OwnerUserId = ownerId.Value, SeriesId = seriesId, Mode = parsed.Value.Mode,
            EffectiveFrom = DateTime.SpecifyKind(timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Unspecified),
        };
        for (var index = 0; index < parsed.Value.Routes.Count; index++)
        {
            var route = parsed.Value.Routes[index];
            rule.Routes.Add(new BudgetIncomeVarianceRuleRoute
            {
                OwnerUserId = ownerId.Value, Position = index, Destination = route.Destination,
                TargetId = route.TargetId, Value = route.Value,
            });
        }
        database.IncomeVarianceRules.Add(rule);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(rule);
    }

    private static (IncomeVarianceRuleInput? Value, IResult? Error) ParseRule(VarianceRuleRequest? request)
    {
        if (request is null) return (null, null);
        var input = new IncomeVarianceRuleInput(
            request.Mode?.Trim().ToLowerInvariant() ?? "",
            (request.Routes ?? []).Select(x => new IncomeVarianceRouteInput(
                x.Destination?.Trim().ToLowerInvariant() ?? "", x.Value, x.TargetId)).ToList());
        try
        {
            _ = BudgetIncomeVarianceRouter.Route(1_000_000, input.Mode, input.Routes);
            return (input, null);
        }
        catch (ArgumentException exception)
        {
            return (null, Invalid(exception.Message));
        }
    }

    private static bool TryDate(string? value, out DateOnly date) => DateOnly.TryParseExact(
        value, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out date);
    private static IResult InvalidDate(string field) => HttpResults.Problem(400, "Invalid date", $"{field} must use YYYY-MM-DD");
    private static IResult Invalid(string detail) => HttpResults.Problem(422, "Validation failed", detail);
    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
}

public sealed record ConfirmIncomeRequest(string? ActualOn, long ActualAmountCents, VarianceRuleRequest? Routing);
public sealed record VarianceRuleRequest(string? Mode, IReadOnlyList<VarianceRouteRequest>? Routes);
public sealed record VarianceRouteRequest(string? Destination, long Value, Guid? TargetId);
