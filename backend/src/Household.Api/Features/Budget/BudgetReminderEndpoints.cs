using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static class BudgetReminderEndpoints
{
    public static RouteGroupBuilder MapBudgetReminderEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapGet("/reminders", List);
        budget.MapGet("/reminders/settings", Settings);
        budget.MapPut("/reminders/settings/{planKind}/{seriesId:guid}", Save);
        return budget;
    }

    private static async Task<IResult> Settings(
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        return Results.Ok(await database.ReminderSettings.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id)
            .OrderBy(x => x.PlanKind).ThenBy(x => x.SeriesId)
            .ToListAsync(cancellationToken));
    }

    private static async Task<IResult> Save(
        string planKind, Guid seriesId, ReminderSettingRequest request,
        HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var exists = planKind switch
        {
            BudgetValues.Income => await database.IncomePlans.AnyAsync(
                x => x.OwnerUserId == user.Id && x.SeriesId == seriesId, cancellationToken),
            "commitment" => await database.CommitmentPlans.AnyAsync(
                x => x.OwnerUserId == user.Id && x.SeriesId == seriesId, cancellationToken),
            _ => false,
        };
        if (!exists) return HttpResults.Problem(404, "Not found", "Recurring plan was not found");
        var setting = await database.ReminderSettings.SingleOrDefaultAsync(x =>
            x.OwnerUserId == user.Id && x.PlanKind == planKind && x.SeriesId == seriesId, cancellationToken);
        if (setting is null)
        {
            setting = new BudgetReminderSetting
            {
                OwnerUserId = user.Id,
                PlanKind = planKind,
                SeriesId = seriesId,
            };
            database.ReminderSettings.Add(setting);
        }
        setting.DueEnabled = request.DueEnabled;
        setting.OverdueEnabled = request.OverdueEnabled;
        setting.UpdatedAt = DateTime.SpecifyKind(timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Unspecified);
        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            database.ChangeTracker.Clear();
            var winner = await database.ReminderSettings.SingleAsync(x =>
                x.OwnerUserId == user.Id && x.PlanKind == planKind && x.SeriesId == seriesId, cancellationToken);
            winner.DueEnabled = request.DueEnabled;
            winner.OverdueEnabled = request.OverdueEnabled;
            winner.UpdatedAt = DateTime.SpecifyKind(timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Unspecified);
            await database.SaveChangesAsync(cancellationToken);
            return Results.Ok(winner);
        }
        return Results.Ok(setting);
    }

    private static async Task<IResult> List(
        string? asOf, HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        if (!string.IsNullOrWhiteSpace(asOf) && !DateOnly.TryParseExact(
                asOf, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out today))
            return HttpResults.Problem(400, "Invalid date", "asOf must use YYYY-MM-DD");
        var settings = await database.ReminderSettings.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && (x.DueEnabled || x.OverdueEnabled))
            .ToListAsync(cancellationToken);
        if (settings.Count == 0) return Results.Ok(Array.Empty<BudgetReminder>());

        var reminders = new List<BudgetReminder>();
        var incomeSettings = settings.Where(x => x.PlanKind == BudgetValues.Income)
            .ToDictionary(x => x.SeriesId);
        if (incomeSettings.Count > 0)
        {
            var projection = await new BudgetIncomePlanProjector(database).LoadAsync(
                user.Id, today.AddYears(-1), today, cancellationToken);
            var automaticVersions = projection.Plans.SelectMany(x => x.Versions)
                .Where(x => x.AutomaticPosting).Select(x => x.Id).ToHashSet();
            reminders.AddRange(projection.Occurrences.Where(x =>
                    x.Status == "expected" && !automaticVersions.Contains(x.VersionId) &&
                    incomeSettings.ContainsKey(x.SeriesId))
                .Select(x => Build(BudgetValues.Income, x.Id, x.SeriesId, x.OccurredOn,
                    x.Name, x.AmountCents, incomeSettings[x.SeriesId], today))
                .Where(x => x is not null)!);
        }
        var commitmentSettings = settings.Where(x => x.PlanKind == "commitment")
            .ToDictionary(x => x.SeriesId);
        if (commitmentSettings.Count > 0)
        {
            var projection = await new BudgetCommitmentProjector(database).LoadAsync(
                user.Id, today.AddYears(-1), today, cancellationToken);
            var automaticVersions = projection.Plans.SelectMany(x => x.Versions)
                .Where(x => x.AutomaticPosting).Select(x => x.Id).ToHashSet();
            reminders.AddRange(projection.Occurrences.Where(x =>
                    x.Status == "expected" && !automaticVersions.Contains(x.VersionId) &&
                    commitmentSettings.ContainsKey(x.SeriesId))
                .Select(x => Build("commitment", x.Id, x.SeriesId, x.OccurredOn,
                    x.Name, x.AmountCents, commitmentSettings[x.SeriesId], today))
                .Where(x => x is not null)!);
        }
        return Results.Ok(reminders.OrderByDescending(x => x!.Kind == "overdue")
            .ThenBy(x => x!.DueOn).ThenBy(x => x!.Id));
    }

    private static BudgetReminder? Build(
        string planKind, string occurrenceId, Guid seriesId, DateOnly dueOn,
        string name, long amountCents, BudgetReminderSetting setting, DateOnly today)
    {
        var kind = dueOn < today && setting.OverdueEnabled ? "overdue" :
            dueOn == today && setting.DueEnabled ? "due" : null;
        return kind is null ? null : new BudgetReminder(
            $"{planKind}:{occurrenceId}:{kind}", planKind, seriesId, occurrenceId,
            kind, dueOn, name, amountCents);
    }

    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
}

public sealed record ReminderSettingRequest(bool DueEnabled, bool OverdueEnabled);
public sealed record BudgetReminder(
    string Id, string PlanKind, Guid SeriesId, string OccurrenceId,
    string Kind, DateOnly DueOn, string Name, long AmountCents);
