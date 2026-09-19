using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Household.Api.Features.Budget;

// ApplyToCurrentPeriod rewrites the running period instead of starting next period.
// Past periods keep the plan version that produced them either way.
public sealed record SaveMonthlyPlan(long Revision, MonthlyPlan Plan, long OpeningSavingsCents,
    string TimeZoneId, bool ApplyToCurrentPeriod = false);
public sealed record SaveMonthlyCategory(string Name, bool Archived = false);
public sealed record AddMonthlyExpense(string RequestKey, DateOnly OccurredOn, string Description,
    Guid CategoryId, long AmountCents, IReadOnlyList<MonthlyFunding>? Funding, Guid? CorrectsId = null)
{
    /// A catalog merchant or one of the user's own. Optional, and never affects the money.
    public Guid? MerchantId { get; init; }
}
public sealed record RefundMonthlyExpense(string RequestKey, DateOnly OccurredOn, long AmountCents);
public sealed record VoidMonthlyExpense(string RequestKey);

public static class MonthlyBudgetEndpoints
{
    public static void MapMonthlyBudgetEndpoints(this IEndpointRouteBuilder budget)
    {
        Microsoft.AspNetCore.Routing.RouteGroupBuilder group = budget.MapGroup("/monthly");
        group.AddEndpointFilter(async (context, next) =>
        {
            try { return await next(context); }
            catch (MonthlyBudgetConflict conflict)
            {
                return HttpResults.Problem(409, "Budget conflict", conflict.Message);
            }
        });
        group.MapGet("/", Get);
        group.MapPut("/plan", SavePlan);
        group.MapPost("/plan/preview", PreviewPlan);
        group.MapDelete("/plan/pending", CancelPending);
        group.MapPost("/categories", CreateCategory);
        group.MapPatch("/categories/{id:guid}", UpdateCategory);
        group.MapPost("/expenses", AddExpense);
        group.MapPost("/expenses/{id:guid}/refunds", Refund);
        group.MapPost("/expenses/{id:guid}/void", Void);
    }

    private static IResult Invalid(string code = "invalid_input") => HttpResults.Problem(422, "Validation failed", code);

    private static async Task<IResult> Get(DateOnly? date, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, TimeProvider clock, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        return Results.Ok(await new MonthlyBudgetStore(database, clock).StateAsync(user.Id, date, cancellationToken));
    }

    private static async Task<IResult> PreviewPlan(SaveMonthlyPlan request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, TimeProvider clock, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        MonthlyBudgetState state = await new MonthlyBudgetStore(database, clock).StateAsync(user.Id, null, cancellationToken);
        if (!MonthlyBudgetValidation.Plan(request.Plan, state.Categories)) return Invalid();
        DateOnly effective = EffectiveFrom(request, state);
        MonthlyPlanRow row = new() { EffectiveFrom = effective, PlanJson = MonthlyBudgetStore.Serialize(request.Plan) };
        return Results.Ok(MonthlyBudgetStore.Forecast([row], effective, state.StartDay));
    }

    private static async Task<IResult> SavePlan(SaveMonthlyPlan request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, TimeProvider clock, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        MonthlyBudgetStore store = new(database, clock);
        await using IDbContextTransaction transaction = await store.LockAsync(user.Id, cancellationToken);
        MonthlyBudgetState state = await store.StateAsync(user.Id, null, cancellationToken);
        if (request.Revision != state.Revision) throw new MonthlyBudgetConflict("plan_changed");
        if (!MonthlyBudgetValidation.Plan(request.Plan, state.Categories) || !MonthlyBudgetValidation.Money(request.OpeningSavingsCents))
            return Invalid();
        if (string.IsNullOrWhiteSpace(request.TimeZoneId) || !TimeZoneInfo.TryFindSystemTimeZoneById(request.TimeZoneId, out TimeZoneInfo? zone))
            return Invalid("invalid_timezone");
        if (state.CurrentPlan is not null && (request.OpeningSavingsCents != state.OpeningSavingsCents || request.TimeZoneId != state.TimeZoneId))
            return Invalid("opening_balance_locked");
        DateOnly today = store.Today(zone.Id);
        DateOnly currentStart = BudgetPeriodCalendar.ForDate(today, state.StartDay).Start;
        DateOnly effective = EffectiveFrom(request, state with { Today = today });
        MonthlyPlanRow row = new()
        {
            Id = Guid.NewGuid(), OwnerUserId = user.Id, Revision = state.Revision + 1, EffectiveFrom = effective,
            StartDay = state.StartDay, Currency = state.Currency, TimeZoneId = zone.Id,
            OpeningSavingsCents = request.OpeningSavingsCents, PlanJson = MonthlyBudgetStore.Serialize(request.Plan),
        };
        if (MonthlyBudgetStore.Forecast([row], effective, state.StartDay).Any(period => period.FunCents < 0))
            return Invalid("plan_unaffordable");
        // Rewriting the running period changes what already-recorded expenses were funded from,
        // so replay the history against the new plan before accepting it.
        if (effective <= currentStart && state.CurrentPlan is not null)
        {
            List<MonthlyPlanRow> plans = await store.PlansAsync(user.Id, cancellationToken);
            plans.Add(row);
            VerifyHistory(plans, await store.EntriesAsync(user.Id, cancellationToken), store);
        }
        database.MonthlyPlans.Add(row);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(await store.StateAsync(user.Id, null, cancellationToken));
    }

    private static async Task<IResult> CancelPending(long revision, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, TimeProvider clock, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        MonthlyBudgetStore store = new(database, clock);
        await using IDbContextTransaction transaction = await store.LockAsync(user.Id, cancellationToken);
        List<MonthlyPlanRow> plans = await store.PlansAsync(user.Id, cancellationToken);
        if (plans.Count == 0) return Invalid("setup_required");
        if (plans[^1].Revision != revision) throw new MonthlyBudgetConflict("plan_changed");
        DateOnly start = BudgetPeriodCalendar.ForDate(store.Today(plans[0].TimeZoneId), plans[0].StartDay).Start;
        MonthlyPlanRow active = plans.Last(row => row.EffectiveFrom <= start);
        if (plans[^1].EffectiveFrom > start)
        {
            database.MonthlyPlans.Add(active with
            {
                Id = Guid.NewGuid(), Revision = revision + 1, EffectiveFrom = plans[^1].EffectiveFrom,
            });
            await database.SaveChangesAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(await store.StateAsync(user.Id, null, cancellationToken));
    }

    private static async Task<IResult> CreateCategory(SaveMonthlyCategory request, HttpContext context,
        IIdentityAccess identity, BudgetDbContext database, TimeProvider clock, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        if (!MonthlyBudgetValidation.Name(request.Name)) return Invalid();
        MonthlyBudgetStore store = new(database, clock);
        await using IDbContextTransaction transaction = await store.LockAsync(user.Id, cancellationToken);
        if (await database.MonthlyCategories.AnyAsync(row => row.OwnerUserId == user.Id && row.Name == request.Name.Trim(), cancellationToken))
            throw new MonthlyBudgetConflict("category_exists");
        MonthlyCategoryRow category = new() { Id = Guid.NewGuid(), OwnerUserId = user.Id, Name = request.Name.Trim() };
        database.MonthlyCategories.Add(category);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(category);
    }

    private static async Task<IResult> UpdateCategory(Guid id, SaveMonthlyCategory request, HttpContext context,
        IIdentityAccess identity, BudgetDbContext database, TimeProvider clock, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        if (!MonthlyBudgetValidation.Name(request.Name)) return Invalid();
        MonthlyBudgetStore store = new(database, clock);
        await using IDbContextTransaction transaction = await store.LockAsync(user.Id, cancellationToken);
        MonthlyCategoryRow? category = await database.MonthlyCategories.SingleOrDefaultAsync(
            row => row.OwnerUserId == user.Id && row.Id == id, cancellationToken);
        if (category is null) return Results.NotFound();
        if (await database.MonthlyCategories.AnyAsync(row => row.OwnerUserId == user.Id && row.Id != id && row.Name == request.Name.Trim(), cancellationToken))
            throw new MonthlyBudgetConflict("category_exists");
        // An active reservation is removed through next period's plan before archival.
        MonthlyBudgetState state = await store.StateAsync(user.Id, null, cancellationToken);
        if (request.Archived && new[] { state.CurrentPlan, state.NextPlan }.Any(plan =>
                plan?.Reserves.Any(reserve => reserve.CategoryId == id && reserve.AmountCents > 0) == true))
            throw new MonthlyBudgetConflict("category_reserved");
        category.Name = request.Name.Trim();
        category.Archived = request.Archived;
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(category);
    }

    private static async Task<IResult> AddExpense(AddMonthlyExpense request, HttpContext context,
        IIdentityAccess identity, BudgetDbContext database, TimeProvider clock, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        if (!ValidKey(request.RequestKey) || request.AmountCents <= 0 || !MonthlyBudgetValidation.Money(request.AmountCents) ||
            request.Description is null || request.Description.Length > 300) return Invalid();
        MonthlyBudgetStore store = new(database, clock);
        await using IDbContextTransaction transaction = await store.LockAsync(user.Id, cancellationToken);
        List<MonthlyEntryRow> rows = await store.EntriesAsync(user.Id, cancellationToken);
        string requestJson = MonthlyBudgetStore.Serialize(request);
        if (Retry(rows, request.RequestKey, requestJson) is IResult retry) return retry;
        List<MonthlyPlanRow> plans = await store.PlansAsync(user.Id, cancellationToken);
        if (!ValidDate(plans, store, request.OccurredOn)) return Invalid("invalid_date");
        MonthlyCategoryRow? category = await database.MonthlyCategories.AsNoTracking().SingleOrDefaultAsync(
            row => row.OwnerUserId == user.Id && row.Id == request.CategoryId && !row.Archived, cancellationToken);
        if (category is null) return Invalid("invalid_category");
        if (request.MerchantId is Guid merchantId && !await database.Merchants.AnyAsync(
            row => row.Id == merchantId && (row.OwnerUserId == null || row.OwnerUserId == user.Id), cancellationToken))
            return Invalid("invalid_merchant");
        BudgetPeriodRange period = BudgetPeriodCalendar.ForDate(request.OccurredOn, plans[0].StartDay);
        MonthlyPlan plan = MonthlyBudgetStore.ActivePlan(plans, period.Start);
        bool reserved = plan.Reserves.Any(reserve => reserve.CategoryId == category.Id && reserve.AmountCents > 0);
        IReadOnlyList<MonthlyFunding> funding = request.Funding ??
            [new(reserved ? "category" : "fun", reserved ? category.Id : null, request.AmountCents)];
        if (!MonthlyBudgetValidation.Funding(funding, request.AmountCents, category.Id)) return Invalid("invalid_funding");
        if (request.CorrectsId is Guid originalId)
        {
            MonthlyExpense? original = MonthlyBudgetStore.EffectiveEntries(rows).SingleOrDefault(entry => entry.Id == originalId && entry.Kind == "expense");
            if (original is null) return Results.NotFound();
            EnsureNoRefunds(rows, originalId);
            MonthlyEntryRow reversal = Row(user.Id, Guid.NewGuid().ToString(), "{}", original with { Id = Guid.NewGuid(), Kind = "void", RelatedId = originalId }, clock);
            rows.Add(reversal);
            database.MonthlyEntries.Add(reversal);
        }
        MonthlyExpense expense = new(Guid.NewGuid(), request.OccurredOn, request.Description.Trim(), category.Id,
            category.Name, request.AmountCents, funding, "expense", request.CorrectsId) { MerchantId = request.MerchantId };
        MonthlyEntryRow row = Row(user.Id, request.RequestKey, requestJson, expense, clock);
        rows.Add(row);
        VerifyHistory(plans, rows, store);
        database.MonthlyEntries.Add(row);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(expense);
    }

    private static async Task<IResult> Refund(Guid id, RefundMonthlyExpense request, HttpContext context,
        IIdentityAccess identity, BudgetDbContext database, TimeProvider clock, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        if (!ValidKey(request.RequestKey) || request.AmountCents <= 0 || !MonthlyBudgetValidation.Money(request.AmountCents)) return Invalid();
        MonthlyBudgetStore store = new(database, clock);
        await using IDbContextTransaction transaction = await store.LockAsync(user.Id, cancellationToken);
        List<MonthlyEntryRow> rows = await store.EntriesAsync(user.Id, cancellationToken);
        string requestJson = MonthlyBudgetStore.Serialize(new { id, request });
        if (Retry(rows, request.RequestKey, requestJson) is IResult retry) return retry;
        List<MonthlyPlanRow> plans = await store.PlansAsync(user.Id, cancellationToken);
        if (!ValidDate(plans, store, request.OccurredOn)) return Invalid("invalid_date");
        List<MonthlyExpense> effective = MonthlyBudgetStore.EffectiveEntries(rows);
        MonthlyExpense? original = effective.SingleOrDefault(entry => entry.Id == id && entry.Kind == "expense");
        if (original is null) return Results.NotFound();
        if (request.OccurredOn < original.OccurredOn) return Invalid("invalid_date");
        List<MonthlyExpense> refunds = effective.Where(entry => entry.Kind == "refund" && entry.RelatedId == id).ToList();
        if (request.AmountCents > original.AmountCents - refunds.Sum(entry => entry.AmountCents)) return Invalid("refund_exceeds_expense");
        long remainder = request.AmountCents;
        List<MonthlyFunding> funding = [];
        foreach (MonthlyFunding source in original.Funding)
        {
            long refunded = refunds.SelectMany(entry => entry.Funding).Where(part => part.Source == source.Source).Sum(part => part.AmountCents);
            long amount = Math.Min(remainder, source.AmountCents - refunded);
            if (amount > 0) funding.Add(source with { AmountCents = amount });
            remainder -= amount;
        }
        MonthlyExpense expense = new(Guid.NewGuid(), request.OccurredOn, original.Description, original.CategoryId,
            original.CategoryName, request.AmountCents, funding, "refund", id) { MerchantId = original.MerchantId };
        MonthlyEntryRow row = Row(user.Id, request.RequestKey, requestJson, expense, clock);
        rows.Add(row);
        VerifyHistory(plans, rows, store);
        database.MonthlyEntries.Add(row);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(expense);
    }

    private static async Task<IResult> Void(Guid id, VoidMonthlyExpense request, HttpContext context,
        IIdentityAccess identity, BudgetDbContext database, TimeProvider clock, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        if (!ValidKey(request.RequestKey)) return Invalid();
        MonthlyBudgetStore store = new(database, clock);
        await using IDbContextTransaction transaction = await store.LockAsync(user.Id, cancellationToken);
        List<MonthlyEntryRow> rows = await store.EntriesAsync(user.Id, cancellationToken);
        string requestJson = MonthlyBudgetStore.Serialize(new { id, request });
        if (Retry(rows, request.RequestKey, requestJson) is IResult retry) return retry;
        MonthlyExpense? original = MonthlyBudgetStore.EffectiveEntries(rows).SingleOrDefault(entry => entry.Id == id);
        if (original is null) return Results.NotFound();
        EnsureNoRefunds(rows, id);
        MonthlyEntryRow row = Row(user.Id, request.RequestKey, requestJson,
            original with { Id = Guid.NewGuid(), Kind = "void", RelatedId = id }, clock);
        rows.Add(row);
        List<MonthlyPlanRow> plans = await store.PlansAsync(user.Id, cancellationToken);
        VerifyHistory(plans, rows, store);
        database.MonthlyEntries.Add(row);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { id });
    }

    private static DateOnly EffectiveFrom(SaveMonthlyPlan request, MonthlyBudgetState state) =>
        state.CurrentPlan is null || request.ApplyToCurrentPeriod
            ? BudgetPeriodCalendar.ForDate(state.Today, state.StartDay).Start
            : state.NextStart;

    private static bool ValidKey(string? key) => !string.IsNullOrWhiteSpace(key) && key.Length <= 100;
    private static bool ValidDate(IReadOnlyList<MonthlyPlanRow> plans, MonthlyBudgetStore store, DateOnly date) =>
        plans.Count > 0 && date >= plans[0].EffectiveFrom && date <= store.Today(plans[0].TimeZoneId);
    private static void EnsureNoRefunds(IReadOnlyList<MonthlyEntryRow> rows, Guid id)
    {
        if (MonthlyBudgetStore.EffectiveEntries(rows).Any(entry => entry.Kind == "refund" && entry.RelatedId == id))
            throw new MonthlyBudgetConflict("reverse_refunds_first");
    }
    private static void VerifyHistory(IReadOnlyList<MonthlyPlanRow> plans, IReadOnlyList<MonthlyEntryRow> rows, MonthlyBudgetStore store) =>
        MonthlyBudgetCalculator.Project(MonthlyBudgetStore.Versions(plans), MonthlyBudgetStore.EffectiveEntries(rows),
            store.Today(plans[0].TimeZoneId), plans[0].StartDay, plans[0].OpeningSavingsCents);
    private static MonthlyEntryRow Row(Guid owner, string key, string requestJson, MonthlyExpense expense, TimeProvider clock) => new()
    {
        Id = expense.Id, OwnerUserId = owner, RequestKey = key, RequestJson = requestJson,
        OccurredOn = expense.OccurredOn, Kind = expense.Kind, RelatedId = expense.RelatedId,
        ExpenseJson = MonthlyBudgetStore.Serialize(expense), CreatedAt = clock.GetUtcNow().UtcDateTime,
    };
    private static IResult? Retry(IReadOnlyList<MonthlyEntryRow> rows, string key, string requestJson)
    {
        MonthlyEntryRow? row = rows.SingleOrDefault(entry => entry.RequestKey == key);
        if (row is null) return null;
        if (!System.Text.Json.Nodes.JsonNode.DeepEquals(System.Text.Json.Nodes.JsonNode.Parse(row.RequestJson),
                System.Text.Json.Nodes.JsonNode.Parse(requestJson))) throw new MonthlyBudgetConflict("request_key_reused");
        return row.Kind == "void" ? Results.Ok(new { id = row.RelatedId }) :
            Results.Ok(MonthlyBudgetStore.Deserialize<MonthlyExpense>(row.ExpenseJson));
    }
}
