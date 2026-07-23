using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static class BudgetCommitmentEndpoints
{
    public static RouteGroupBuilder MapBudgetCommitmentEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapGet("/commitments", List);
        budget.MapPost("/commitments", Create);
        budget.MapPatch("/commitments/{seriesId:guid}", Edit);
        budget.MapPost("/commitments/{seriesId:guid}/pauses", Pause);
        budget.MapPost("/commitments/{seriesId:guid}/stop", Stop);
        budget.MapPost("/commitments/{seriesId:guid}/occurrences/{scheduledOn}/confirm", Confirm);
        budget.MapPost("/commitments/{seriesId:guid}/occurrences/{scheduledOn}/match", Match);
        budget.MapPost("/commitments/auto-post", AutoPost);
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
        try { return Results.Ok(await new BudgetCommitmentProjector(database).LoadAsync(user.Id, start, end, cancellationToken)); }
        catch (ArgumentOutOfRangeException exception) { return Invalid(exception.Message); }
    }

    private static async Task<IResult> Create(
        CommitmentRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var parsed = await ParseDefinition(request, user.Id, database, cancellationToken);
        if (parsed.Error is not null) return parsed.Error;
        var value = parsed.Value!;
        var seriesId = Guid.NewGuid();
        var plan = NewVersion(seriesId, user.Id, value, value.StartDate, null, "");
        plan.Id = seriesId;
        database.CommitmentPlans.Add(plan);
        if (value.StopDate.HasValue)
            database.CommitmentStops.Add(new BudgetCommitmentStop
            {
                OwnerUserId = user.Id, SeriesId = seriesId, EffectiveOn = value.StopDate.Value,
                Reason = "Stop date configured when the plan was created",
            });
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/commitments/{seriesId}", plan);
    }

    private static async Task<IResult> Edit(
        Guid seriesId, CommitmentEditRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Reason)) return Invalid("An edit reason is required");
        if (request.Scope == "occurrence") return await EditOccurrence(seriesId, request, user.Id, database, cancellationToken);
        if (request.Scope is not ("future" or "effective_date")) return Invalid("Edit scope must be occurrence, future, or effective_date");
        if (!TryDate(request.EffectiveOn, out var effectiveOn)) return InvalidDate("effectiveOn");
        if (await database.CommitmentStops.AnyAsync(x => x.OwnerUserId == user.Id && x.SeriesId == seriesId, cancellationToken))
            return Conflict("A stopped commitment cannot receive future edits");
        var source = await database.CommitmentPlans.SingleOrDefaultAsync(x =>
            x.OwnerUserId == user.Id && x.SeriesId == seriesId && x.Active && x.EffectiveFrom <= effectiveOn &&
            (x.EffectiveTo == null || x.EffectiveTo >= effectiveOn), cancellationToken);
        if (source is null) return NotFound();
        var parsed = await ParseDefinition(new CommitmentRequest(
            request.CategoryId ?? source.CategoryId, request.Kind ?? source.Kind, request.Name ?? source.Name,
            request.AmountCents ?? source.AmountCents, request.Cadence ?? source.Cadence,
            request.IntervalUnit ?? source.IntervalUnit, request.IntervalCount ?? source.IntervalCount,
            request.Weekdays ?? ParseWeekdays(source.Weekdays), source.StartDate.ToString("yyyy-MM-dd"), null,
            request.BudgetingMode ?? source.BudgetingMode, request.AutomaticPosting ?? source.AutomaticPosting),
            user.Id, database, cancellationToken);
        if (parsed.Error is not null) return parsed.Error;
        var previousEnd = source.EffectiveTo;
        if (effectiveOn == source.EffectiveFrom) source.Active = false; else source.EffectiveTo = effectiveOn.AddDays(-1);
        var version = NewVersion(seriesId, user.Id, parsed.Value!, effectiveOn, previousEnd, request.Reason.Trim());
        database.CommitmentPlans.Add(version);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(version);
    }

    private static async Task<IResult> EditOccurrence(
        Guid seriesId, CommitmentEditRequest request, Guid ownerId, BudgetDbContext database, CancellationToken cancellationToken)
    {
        if (!TryDate(request.ScheduledOn, out var scheduledOn)) return InvalidDate("scheduledOn");
        var projection = await new BudgetCommitmentProjector(database).LoadAsync(ownerId, scheduledOn, scheduledOn, cancellationToken);
        var occurrence = projection.Occurrences.SingleOrDefault(x => x.SeriesId == seriesId && x.ScheduledOn == scheduledOn);
        if (occurrence is null) return NotFound("Expected commitment occurrence was not found");
        var occurredOn = scheduledOn;
        if (!string.IsNullOrWhiteSpace(request.OccurredOn) && !TryDate(request.OccurredOn, out occurredOn)) return InvalidDate("occurredOn");
        var amount = request.AmountCents ?? occurrence.AmountCents;
        if (amount <= 0) return Invalid("Commitment amount must be positive");
        var value = new BudgetCommitmentOccurrenceOverride
        {
            OwnerUserId = ownerId, SeriesId = seriesId, ScheduledOn = scheduledOn, OccurredOn = occurredOn,
            Name = string.IsNullOrWhiteSpace(request.Name) ? occurrence.Name : request.Name.Trim(),
            AmountCents = amount, Reason = request.Reason!.Trim(),
        };
        database.CommitmentOccurrenceOverrides.Add(value);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(value);
    }

    private static async Task<IResult> Pause(
        Guid seriesId, CommitmentPauseRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (!await database.CommitmentPlans.AnyAsync(x => x.OwnerUserId == user.Id && x.SeriesId == seriesId, cancellationToken)) return NotFound();
        if (!TryDate(request.From, out var from) || !TryDate(request.Through, out var through)) return InvalidDate("pause range");
        if (through < from) return Invalid("Pause end must not be before its start");
        var pause = new BudgetCommitmentPause
        {
            OwnerUserId = user.Id, SeriesId = seriesId, From = from, Through = through, Reason = request.Reason?.Trim() ?? "",
        };
        database.CommitmentPauses.Add(pause); await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/commitments/{seriesId}/pauses/{pause.Id}", pause);
    }

    private static async Task<IResult> Stop(
        Guid seriesId, CommitmentStopRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var start = await database.CommitmentPlans.Where(x => x.OwnerUserId == user.Id && x.SeriesId == seriesId)
            .Select(x => (DateOnly?)x.StartDate).MinAsync(cancellationToken);
        if (!start.HasValue) return NotFound();
        if (!TryDate(request.EffectiveOn, out var effectiveOn)) return InvalidDate("effectiveOn");
        if (effectiveOn < start.Value) return Invalid("Stop date must not be before the plan start date");
        if (await database.CommitmentStops.AnyAsync(x => x.OwnerUserId == user.Id && x.SeriesId == seriesId, cancellationToken))
            return Conflict("Commitment is already stopped");
        var stop = new BudgetCommitmentStop
        {
            OwnerUserId = user.Id, SeriesId = seriesId, EffectiveOn = effectiveOn, Reason = request.Reason?.Trim() ?? "",
        };
        database.CommitmentStops.Add(stop); await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/commitments/{seriesId}/stop", stop);
    }

    private static async Task<IResult> Confirm(
        Guid seriesId, string scheduledOn, CommitmentConfirmationRequest request, HttpContext context,
        IIdentityAccess identity, BudgetDbContext database, BudgetService budgetService, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (!TryDate(scheduledOn, out var scheduled)) return InvalidDate("scheduledOn");
        if (!TryDate(request.ActualOn, out var actualOn)) return InvalidDate("actualOn");
        if (request.ActualAmountCents <= 0) return Invalid("Actual amount must be positive");
        var occurrence = await FindOccurrence(user.Id, seriesId, scheduled, database, cancellationToken);
        if (occurrence is null) return NotFound("Expected commitment occurrence was not found");
        var result = await Post(user.Id, occurrence, actualOn, request.ActualAmountCents, BudgetValues.Manual, null, database, budgetService, cancellationToken);
        return result.AlreadyPosted ? Results.Ok(result.Posting) : Results.Created($"/api/v1/budget/ledger/entries/{result.Posting.LedgerEntryId}", result.Posting);
    }

    private static async Task<IResult> Match(
        Guid seriesId, string scheduledOn, CommitmentMatchRequest request, HttpContext context,
        IIdentityAccess identity, BudgetDbContext database, BudgetService budgetService, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (!TryDate(scheduledOn, out var scheduled)) return InvalidDate("scheduledOn");
        var occurrence = await FindOccurrence(user.Id, seriesId, scheduled, database, cancellationToken);
        if (occurrence is null) return NotFound("Expected commitment occurrence was not found");
        var ledger = await database.LedgerEntries.SingleOrDefaultAsync(x =>
            x.OwnerUserId == user.Id && x.Id == request.LedgerEntryId && x.Kind == BudgetValues.Expense, cancellationToken);
        if (ledger is null) return NotFound("Expense ledger entry was not found");
        var result = await Post(user.Id, occurrence, ledger.OccurredOn, ledger.AmountCents, BudgetValues.Matched, ledger, database, budgetService, cancellationToken);
        return result.AlreadyPosted ? Results.Ok(result.Posting) : Results.Created($"/api/v1/budget/ledger/entries/{ledger.Id}", result.Posting);
    }

    private static async Task<IResult> AutoPost(
        string? from, string? through, HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        BudgetService budgetService, TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var end = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        if (!string.IsNullOrWhiteSpace(through) && !TryDate(through, out end)) return InvalidDate("through");
        var start = end.AddYears(-1);
        if (!string.IsNullOrWhiteSpace(from) && !TryDate(from, out start)) return InvalidDate("from");
        CommitmentProjection projection;
        try { projection = await new BudgetCommitmentProjector(database).LoadAsync(user.Id, start, end, cancellationToken); }
        catch (ArgumentOutOfRangeException exception) { return Invalid(exception.Message); }
        var automatic = projection.Plans.SelectMany(x => x.Versions).Where(x => x.AutomaticPosting).Select(x => x.Id).ToHashSet();
        var posted = 0;
        foreach (var occurrence in projection.Occurrences.Where(x => x.Status == "expected" && automatic.Contains(x.VersionId)))
        {
            var result = await Post(user.Id, occurrence, occurrence.OccurredOn, occurrence.AmountCents,
                BudgetValues.Automatic, null, database, budgetService, cancellationToken);
            if (!result.AlreadyPosted) posted++;
        }
        return Results.Ok(new { posted });
    }

    private static async Task<(BudgetCommitmentPosting Posting, bool AlreadyPosted)> Post(
        Guid ownerId, ExpectedCommitmentOccurrence occurrence, DateOnly actualOn, long actualAmount,
        string mode, BudgetLedgerEntry? matchedLedger, BudgetDbContext database, BudgetService budgetService,
        CancellationToken cancellationToken)
    {
        var existing = await database.CommitmentPostings.AsNoTracking().SingleOrDefaultAsync(x =>
            x.OwnerUserId == ownerId && x.SeriesId == occurrence.SeriesId && x.ScheduledOn == occurrence.ScheduledOn, cancellationToken);
        if (existing is not null) return (existing, true);
        var postingId = Guid.NewGuid();
        var ledger = matchedLedger;
        if (ledger is null)
        {
            var period = (await budgetService.EnsureDefaultsAsync(ownerId, actualOn, cancellationToken)).Period;
            ledger = new BudgetLedgerEntry
            {
                Id = Guid.NewGuid(), OwnerUserId = ownerId, PeriodId = period.Id, CategoryId = occurrence.CategoryId,
                Kind = BudgetValues.Expense, OccurredOn = actualOn, Description = occurrence.Name, AmountCents = actualAmount,
                OrdinaryImpactCents = -actualAmount, Source = mode == BudgetValues.Automatic ? "commitment_automatic" : "commitment_confirmation",
                SourceRecordId = postingId,
            };
        }
        var posting = new BudgetCommitmentPosting
        {
            Id = postingId, OwnerUserId = ownerId, SeriesId = occurrence.SeriesId, VersionId = occurrence.VersionId,
            ScheduledOn = occurrence.ScheduledOn, ExpectedOn = occurrence.OccurredOn, ActualOn = actualOn,
            ExpectedAmountCents = occurrence.AmountCents, ActualAmountCents = actualAmount,
            PostingMode = mode, LedgerEntryId = ledger.Id,
        };
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            if (matchedLedger is null)
            {
                database.LedgerEntries.Add(ledger);
                await database.SaveChangesAsync(cancellationToken);
                await AddCategorySplit(ownerId, occurrence.CategoryId, ledger, database, cancellationToken);
            }
            database.CommitmentPostings.Add(posting); await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken); return (posting, false);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken); database.ChangeTracker.Clear();
            var winner = await database.CommitmentPostings.AsNoTracking().SingleOrDefaultAsync(x =>
                x.OwnerUserId == ownerId && x.SeriesId == occurrence.SeriesId && x.ScheduledOn == occurrence.ScheduledOn, cancellationToken);
            if (winner is not null) return (winner, true); throw;
        }
    }

    private static async Task AddCategorySplit(
        Guid ownerId, Guid? categoryId, BudgetLedgerEntry ledger, BudgetDbContext database, CancellationToken cancellationToken)
    {
        if (!categoryId.HasValue) return;
        var version = await database.CategoryVersions.AsNoTracking().Where(x => x.OwnerUserId == ownerId && x.CategoryId == categoryId)
            .OrderByDescending(x => x.EffectiveFrom).FirstOrDefaultAsync(cancellationToken);
        var category = await database.Categories.AsNoTracking().SingleOrDefaultAsync(x => x.OwnerUserId == ownerId && x.Id == categoryId, cancellationToken);
        if (category is null) return;
        database.LedgerSplits.Add(new BudgetLedgerSplit
        {
            OwnerUserId = ownerId, LedgerEntryId = ledger.Id, CategoryId = category.Id, CategoryVersionId = version?.Id,
            CategoryNameSnapshot = version?.Name ?? category.Name, CategoryColorSnapshot = version?.Color ?? category.Color,
            CategoryIconSnapshot = version?.Icon ?? category.Icon, AmountCents = ledger.AmountCents,
            OrdinaryImpactCents = ledger.OrdinaryImpactCents,
        });
        await database.SaveChangesAsync(cancellationToken);
    }

    private static async Task<ExpectedCommitmentOccurrence?> FindOccurrence(
        Guid ownerId, Guid seriesId, DateOnly scheduled, BudgetDbContext database, CancellationToken cancellationToken) =>
        (await new BudgetCommitmentProjector(database).LoadAsync(ownerId, scheduled, scheduled, cancellationToken))
        .Occurrences.SingleOrDefault(x => x.SeriesId == seriesId && x.ScheduledOn == scheduled);

    private static async Task<(CommitmentDefinition? Value, IResult? Error)> ParseDefinition(
        CommitmentRequest request, Guid ownerId, BudgetDbContext database, CancellationToken cancellationToken)
    {
        var name = request.Name?.Trim() ?? "";
        if (name.Length == 0 || request.AmountCents <= 0) return (null, Invalid("Commitments require a name and positive amount"));
        if (request.Kind is not (BudgetValues.FixedCost or BudgetValues.Subscription)) return (null, Invalid("Commitment kind is invalid"));
        if (!TryDate(request.StartDate, out var start)) return (null, InvalidDate("startDate"));
        DateOnly? stop = null;
        if (!string.IsNullOrWhiteSpace(request.StopDate))
        {
            if (!TryDate(request.StopDate, out var parsedStop)) return (null, InvalidDate("stopDate"));
            if (parsedStop < start) return (null, Invalid("Stop date must not be before start date"));
            stop = parsedStop;
        }
        var cadence = request.Cadence?.Trim().ToLowerInvariant() ?? "";
        if (cadence == BudgetValues.Daily) return (null, Invalid("Daily recurrence is not supported for commitments"));
        var unit = cadence switch
        {
            BudgetValues.Weekly => BudgetValues.Week, BudgetValues.Monthly => BudgetValues.Month,
            BudgetValues.Quarterly => BudgetValues.Quarter, BudgetValues.Yearly => BudgetValues.Year,
            BudgetValues.Custom => request.IntervalUnit?.Trim().ToLowerInvariant() ?? "", _ => "",
        };
        if (unit is not (BudgetValues.Week or BudgetValues.Month or BudgetValues.Quarter or BudgetValues.Year))
            return (null, Invalid("Commitment recurrence is invalid"));
        var interval = cadence == BudgetValues.Custom ? request.IntervalCount : 1;
        if (interval <= 0) return (null, Invalid("Custom interval must be positive"));
        var weekdays = (request.Weekdays ?? []).Distinct().Order().ToArray();
        if (weekdays.Any(x => x is < 0 or > 6) || unit != BudgetValues.Week && weekdays.Length > 0)
            return (null, Invalid("Commitment weekdays are invalid"));
        if (cadence != BudgetValues.Custom) weekdays = [];
        if (request.BudgetingMode is not (BudgetValues.DuePeriod or BudgetValues.GradualReservation))
            return (null, Invalid("Budgeting mode is invalid"));
        if (request.CategoryId.HasValue && !await database.Categories.AnyAsync(
                x => x.OwnerUserId == ownerId && x.Id == request.CategoryId, cancellationToken))
            return (null, Invalid("Category was not found"));
        return (new CommitmentDefinition(request.CategoryId, request.Kind, name, request.AmountCents, cadence, unit,
            interval, string.Join(',', weekdays), start, stop, request.BudgetingMode, request.AutomaticPosting), null);
    }

    private static BudgetCommitmentPlan NewVersion(
        Guid seriesId, Guid ownerId, CommitmentDefinition value, DateOnly effectiveFrom, DateOnly? effectiveTo, string reason) => new()
    {
        SeriesId = seriesId, OwnerUserId = ownerId, CategoryId = value.CategoryId, Kind = value.Kind, Name = value.Name,
        AmountCents = value.AmountCents, Cadence = value.Cadence, IntervalUnit = value.IntervalUnit,
        IntervalCount = value.IntervalCount, Weekdays = value.Weekdays, StartDate = value.StartDate,
        EffectiveFrom = effectiveFrom, EffectiveTo = effectiveTo, BudgetingMode = value.BudgetingMode,
        AutomaticPosting = value.AutomaticPosting, ChangeReason = reason,
    };
    private static IReadOnlyList<int> ParseWeekdays(string value) => string.IsNullOrWhiteSpace(value) ? [] : value.Split(',').Select(int.Parse).ToArray();
    private static bool TryDate(string? value, out DateOnly date) => DateOnly.TryParseExact(value, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out date);
    private static IResult InvalidDate(string field) => HttpResults.Problem(400, "Invalid date", $"{field} must use YYYY-MM-DD");
    private static IResult Invalid(string detail) => HttpResults.Problem(422, "Validation failed", detail);
    private static IResult Conflict(string detail) => HttpResults.Problem(409, "Invalid state", detail);
    private static IResult NotFound(string detail = "Commitment was not found") => HttpResults.Problem(404, "Not found", detail);
    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
}

public sealed record CommitmentRequest(
    Guid? CategoryId, string? Kind, string? Name, long AmountCents, string? Cadence, string? IntervalUnit,
    int IntervalCount, IReadOnlyList<int>? Weekdays, string? StartDate, string? StopDate,
    string? BudgetingMode, bool AutomaticPosting);
public sealed record CommitmentEditRequest(
    string? Scope, string? Reason, string? ScheduledOn, string? EffectiveOn, string? OccurredOn,
    Guid? CategoryId, string? Kind, string? Name, long? AmountCents, string? Cadence, string? IntervalUnit,
    int? IntervalCount, IReadOnlyList<int>? Weekdays, string? BudgetingMode, bool? AutomaticPosting);
public sealed record CommitmentPauseRequest(string? From, string? Through, string? Reason);
public sealed record CommitmentStopRequest(string? EffectiveOn, string? Reason);
public sealed record CommitmentConfirmationRequest(string? ActualOn, long ActualAmountCents);
public sealed record CommitmentMatchRequest(Guid LedgerEntryId);
internal sealed record CommitmentDefinition(
    Guid? CategoryId, string Kind, string Name, long AmountCents, string Cadence, string IntervalUnit,
    int IntervalCount, string Weekdays, DateOnly StartDate, DateOnly? StopDate,
    string BudgetingMode, bool AutomaticPosting);
