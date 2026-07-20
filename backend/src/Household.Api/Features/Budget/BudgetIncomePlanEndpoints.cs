using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static class BudgetIncomePlanEndpoints
{
    public static RouteGroupBuilder MapBudgetIncomePlanEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapGet("/income-plans", List);
        budget.MapPost("/income-plans", Create);
        budget.MapPatch("/income-plans/{seriesId:guid}", Edit);
        budget.MapPost("/income-plans/{seriesId:guid}/pauses", Pause);
        budget.MapPost("/income-plans/{seriesId:guid}/stop", Stop);
        return budget;
    }

    private static async Task<IResult> List(
        string? from, string? through, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var start = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        if (!string.IsNullOrWhiteSpace(from) && !TryDate(from, out start)) return InvalidDate("from");
        var end = start.AddYears(1);
        if (!string.IsNullOrWhiteSpace(through) && !TryDate(through, out end)) return InvalidDate("through");
        try
        {
            return Results.Ok(await new BudgetIncomePlanProjector(database).LoadAsync(user.Id, start, end, cancellationToken));
        }
        catch (ArgumentOutOfRangeException exception)
        {
            return Invalid(exception.Message);
        }
    }

    private static async Task<IResult> Create(
        IncomePlanRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var parsed = ParseDefinition(request);
        if (parsed.Error is not null) return parsed.Error;
        var definition = parsed.Value!;
        var seriesId = Guid.NewGuid();
        var plan = new BudgetIncomePlan
        {
            Id = seriesId, SeriesId = seriesId, OwnerUserId = user.Id, Name = definition.Name,
            AmountCents = definition.AmountCents, Cadence = definition.Cadence,
            IntervalUnit = definition.IntervalUnit, IntervalCount = definition.IntervalCount,
            Weekdays = definition.Weekdays, StartDate = definition.StartDate,
            EffectiveFrom = definition.StartDate,
        };
        database.IncomePlans.Add(plan);
        if (definition.StopDate.HasValue)
            database.IncomePlanStops.Add(new BudgetIncomePlanStop
            {
                OwnerUserId = user.Id, SeriesId = seriesId, EffectiveOn = definition.StopDate.Value,
                Reason = "Stop date configured when the plan was created",
            });
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/income-plans/{seriesId}", plan);
    }

    private static async Task<IResult> Edit(
        Guid seriesId, IncomePlanEditRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Reason)) return Invalid("An edit reason is required");
        if (request.Scope == "occurrence")
            return await EditOccurrence(seriesId, request, user.Id, database, cancellationToken);
        if (request.Scope is not ("future" or "effective_date"))
            return Invalid("Edit scope must be occurrence, future, or effective_date");
        if (!TryDate(request.EffectiveOn, out var effectiveOn)) return InvalidDate("effectiveOn");
        if (await database.IncomePlanStops.AnyAsync(
                x => x.OwnerUserId == user.Id && x.SeriesId == seriesId, cancellationToken))
            return HttpResults.Problem(409, "Stopped plan", "A stopped income plan cannot receive future edits");

        var source = await database.IncomePlans.SingleOrDefaultAsync(x =>
            x.OwnerUserId == user.Id && x.SeriesId == seriesId && x.Active &&
            x.EffectiveFrom <= effectiveOn && (x.EffectiveTo == null || x.EffectiveTo >= effectiveOn), cancellationToken);
        if (source is null) return NotFound();
        var parsed = ParseDefinition(new IncomePlanRequest(
            request.Name ?? source.Name, request.AmountCents ?? source.AmountCents,
            request.Cadence ?? source.Cadence, request.IntervalUnit ?? source.IntervalUnit,
            request.IntervalCount ?? source.IntervalCount, request.Weekdays ?? ParseWeekdays(source.Weekdays),
            source.StartDate.ToString("yyyy-MM-dd"), null));
        if (parsed.Error is not null) return parsed.Error;
        var definition = parsed.Value!;

        var previousEnd = source.EffectiveTo;
        if (effectiveOn == source.EffectiveFrom) source.Active = false;
        else source.EffectiveTo = effectiveOn.AddDays(-1);
        var version = new BudgetIncomePlan
        {
            SeriesId = seriesId, OwnerUserId = user.Id, Name = definition.Name, AmountCents = definition.AmountCents,
            Cadence = definition.Cadence, IntervalUnit = definition.IntervalUnit, IntervalCount = definition.IntervalCount,
            Weekdays = definition.Weekdays, StartDate = source.StartDate, EffectiveFrom = effectiveOn,
            EffectiveTo = previousEnd, ChangeReason = request.Reason.Trim(),
        };
        database.IncomePlans.Add(version);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(version);
    }

    private static async Task<IResult> EditOccurrence(
        Guid seriesId, IncomePlanEditRequest request, Guid ownerId,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        if (!TryDate(request.ScheduledOn, out var scheduledOn)) return InvalidDate("scheduledOn");
        var projection = await new BudgetIncomePlanProjector(database)
            .LoadAsync(ownerId, scheduledOn, scheduledOn, cancellationToken);
        var occurrence = projection.Occurrences.SingleOrDefault(x => x.SeriesId == seriesId && x.ScheduledOn == scheduledOn);
        if (occurrence is null) return NotFound("Expected income occurrence was not found");
        var occurredOn = scheduledOn;
        if (!string.IsNullOrWhiteSpace(request.OccurredOn) && !TryDate(request.OccurredOn, out occurredOn))
            return InvalidDate("occurredOn");
        var name = string.IsNullOrWhiteSpace(request.Name) ? occurrence.Name : request.Name.Trim();
        var amount = request.AmountCents ?? occurrence.AmountCents;
        if (amount <= 0) return Invalid("Income amount must be positive");
        var occurrenceOverride = new BudgetIncomeOccurrenceOverride
        {
            OwnerUserId = ownerId, SeriesId = seriesId, ScheduledOn = scheduledOn, OccurredOn = occurredOn,
            Name = name, AmountCents = amount, Reason = request.Reason!.Trim(),
        };
        database.IncomeOccurrenceOverrides.Add(occurrenceOverride);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(occurrenceOverride);
    }

    private static async Task<IResult> Pause(
        Guid seriesId, PauseIncomePlanRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (!await database.IncomePlans.AnyAsync(x => x.OwnerUserId == user.Id && x.SeriesId == seriesId, cancellationToken))
            return NotFound();
        if (!TryDate(request.From, out var from) || !TryDate(request.Through, out var through))
            return InvalidDate("pause range");
        if (through < from) return Invalid("Pause end must not be before its start");
        var pause = new BudgetIncomePlanPause
        {
            OwnerUserId = user.Id, SeriesId = seriesId, From = from, Through = through,
            Reason = request.Reason?.Trim() ?? "",
        };
        database.IncomePlanPauses.Add(pause);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/income-plans/{seriesId}/pauses/{pause.Id}", pause);
    }

    private static async Task<IResult> Stop(
        Guid seriesId, StopIncomePlanRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var startDate = await database.IncomePlans.Where(x => x.OwnerUserId == user.Id && x.SeriesId == seriesId)
            .Select(x => (DateOnly?)x.StartDate).MinAsync(cancellationToken);
        if (!startDate.HasValue)
            return NotFound();
        if (!TryDate(request.EffectiveOn, out var effectiveOn)) return InvalidDate("effectiveOn");
        if (effectiveOn < startDate.Value) return Invalid("Stop date must not be before the plan start date");
        if (await database.IncomePlanStops.AnyAsync(x => x.OwnerUserId == user.Id && x.SeriesId == seriesId, cancellationToken))
            return HttpResults.Problem(409, "Already stopped", "Income plan is already stopped");
        var stop = new BudgetIncomePlanStop
        {
            OwnerUserId = user.Id, SeriesId = seriesId, EffectiveOn = effectiveOn,
            Reason = request.Reason?.Trim() ?? "",
        };
        database.IncomePlanStops.Add(stop);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/income-plans/{seriesId}/stop", stop);
    }

    private static (IncomePlanDefinition? Value, IResult? Error) ParseDefinition(IncomePlanRequest request)
    {
        var name = request.Name?.Trim() ?? "";
        if (name.Length == 0 || request.AmountCents <= 0) return (null, Invalid("Income plans require a name and positive amount"));
        if (!TryDate(request.StartDate, out var startDate)) return (null, InvalidDate("startDate"));
        DateOnly? stopDate = null;
        if (!string.IsNullOrWhiteSpace(request.StopDate))
        {
            if (!TryDate(request.StopDate, out var parsedStop)) return (null, InvalidDate("stopDate"));
            if (parsedStop < startDate) return (null, Invalid("Stop date must not be before the start date"));
            stopDate = parsedStop;
        }
        var cadence = request.Cadence?.Trim().ToLowerInvariant() ?? "";
        var intervalUnit = cadence switch
        {
            BudgetValues.Daily => BudgetValues.Day,
            BudgetValues.Weekly => BudgetValues.Week,
            BudgetValues.Monthly => BudgetValues.Month,
            BudgetValues.Quarterly => BudgetValues.Quarter,
            BudgetValues.Yearly => BudgetValues.Year,
            BudgetValues.Custom => request.IntervalUnit?.Trim().ToLowerInvariant() ?? "",
            _ => "",
        };
        if (intervalUnit is not (BudgetValues.Day or BudgetValues.Week or BudgetValues.Month or BudgetValues.Quarter or BudgetValues.Year))
            return (null, Invalid("Recurrence must be daily, weekly, monthly, quarterly, yearly, or a supported custom unit"));
        var intervalCount = cadence == BudgetValues.Custom ? request.IntervalCount : 1;
        if (intervalCount <= 0) return (null, Invalid("Custom recurrence interval must be positive"));
        var weekdays = (request.Weekdays ?? []).Distinct().Order().ToArray();
        if (weekdays.Any(x => x is < 0 or > 6)) return (null, Invalid("Weekdays must be between Sunday (0) and Saturday (6)"));
        if (intervalUnit != BudgetValues.Week && weekdays.Length > 0)
            return (null, Invalid("Weekdays are only supported for weekly recurrence"));
        if (cadence != BudgetValues.Custom) weekdays = [];
        return (new IncomePlanDefinition(
            name, request.AmountCents, cadence, intervalUnit, intervalCount,
            string.Join(',', weekdays), startDate, stopDate), null);
    }

    private static IReadOnlyList<int> ParseWeekdays(string value) => string.IsNullOrWhiteSpace(value)
        ? []
        : value.Split(',').Select(int.Parse).ToArray();
    private static bool TryDate(string? value, out DateOnly date) => DateOnly.TryParseExact(
        value, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out date);
    private static IResult InvalidDate(string field) => HttpResults.Problem(400, "Invalid date", $"{field} must use YYYY-MM-DD");
    private static IResult Invalid(string detail) => HttpResults.Problem(422, "Validation failed", detail);
    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
    private static IResult NotFound(string detail = "Income plan was not found") => HttpResults.Problem(404, "Not found", detail);
}

public sealed record IncomePlanRequest(
    string? Name, long AmountCents, string? Cadence, string? IntervalUnit, int IntervalCount,
    IReadOnlyList<int>? Weekdays, string? StartDate, string? StopDate);
public sealed record IncomePlanEditRequest(
    string? Scope, string? Reason, string? ScheduledOn, string? EffectiveOn, string? OccurredOn,
    string? Name, long? AmountCents, string? Cadence, string? IntervalUnit, int? IntervalCount,
    IReadOnlyList<int>? Weekdays);
public sealed record PauseIncomePlanRequest(string? From, string? Through, string? Reason);
public sealed record StopIncomePlanRequest(string? EffectiveOn, string? Reason);
internal sealed record IncomePlanDefinition(
    string Name, long AmountCents, string Cadence, string IntervalUnit, int IntervalCount,
    string Weekdays, DateOnly StartDate, DateOnly? StopDate);
