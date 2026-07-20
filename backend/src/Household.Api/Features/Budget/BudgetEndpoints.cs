using System.Text.RegularExpressions;
using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static partial class BudgetEndpoints
{
    public static IEndpointRouteBuilder MapBudgetEndpoints(this IEndpointRouteBuilder routes)
    {
        var budget = routes.MapGroup("/budget");
        budget.MapBudgetSetupEndpoints();
        budget.MapBudgetLedgerEndpoints();
        budget.MapGet("/healthz", () => Results.NoContent());
        budget.MapGet("/summary", Summary);
        budget.MapGet("/periods/current", GetCurrentPeriod);
        budget.MapPatch("/periods/current", UpdateCurrentPeriod);
        budget.MapPost("/categories", CreateCategory);
        budget.MapPatch("/categories/{categoryId:guid}", UpdateCategory);
        budget.MapGet("/planned-expenses", ListPlannedExpenses);
        budget.MapPost("/planned-expenses", CreatePlannedExpense);
        budget.MapPatch("/planned-expenses/{plannedExpenseId:guid}", UpdatePlannedExpense);
        budget.MapPost("/planned-expenses/apply-current", ApplyCurrentPlannedExpenses);
        budget.MapPost("/transactions", CreateTransaction);
        return routes;
    }

    private static async Task<IResult> GetCurrentPeriod(
        string? date,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var selectedDate = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        if (!string.IsNullOrWhiteSpace(date) && !DateOnly.TryParseExact(
                date, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out selectedDate))
            return HttpResults.Problem(400, "Invalid date", "Date must use YYYY-MM-DD");
        var (period, _, _) = await new BudgetService(database, timeProvider)
            .EnsureDefaultsAsync(user.Id, selectedDate, cancellationToken);
        return Results.Ok(period);
    }

    private static async Task<IResult> Summary(
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        return Results.Ok(await new BudgetService(database, timeProvider).SummaryAsync(user.Id, cancellationToken));
    }

    private static async Task<IResult> UpdateCurrentPeriod(
        UpdatePeriodRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (request.SpendingLimitCents < 0 || request.OverspendCarryoverCents < 0)
            return HttpResults.Problem(422, "Validation failed", "Limit and carryover must not be negative");
        var service = new BudgetService(database, timeProvider);
        var (period, _, _) = await service.EnsureDefaultsAsync(user.Id, DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime), cancellationToken);
        period.SpendingLimitCents = request.SpendingLimitCents;
        period.OverspendCarryoverCents = request.OverspendCarryoverCents;
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(period);
    }

    private static async Task<IResult> CreateCategory(
        CategoryRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var validation = ValidateCategory(request);
        if (validation.Error is not null) return validation.Error;
        var category = new BudgetCategory
        {
            OwnerUserId = user.Id,
            Name = validation.Name,
            Color = validation.Color,
            Behavior = validation.Behavior,
        };
        database.Categories.Add(category);
        try { await database.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return HttpResults.Problem(400, "Invalid category", "Category could not be created"); }
        return Results.Created($"/api/v1/budget/categories/{category.Id}", category);
    }

    private static async Task<IResult> UpdateCategory(
        Guid categoryId,
        CategoryRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var validation = ValidateCategory(request);
        if (validation.Error is not null) return validation.Error;
        var category = await database.Categories.SingleOrDefaultAsync(
            x => x.Id == categoryId && x.OwnerUserId == user.Id, cancellationToken);
        if (category is null) return HttpResults.Problem(404, "Not found", "Category was not found");
        category.Name = validation.Name; category.Color = validation.Color; category.Behavior = validation.Behavior;
        try { await database.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return HttpResults.Problem(400, "Invalid category", "Category could not be updated"); }
        return Results.Ok(category);
    }

    private static async Task<IResult> ListPlannedExpenses(
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        return Results.Ok(await database.PlannedExpenses.AsNoTracking().Where(x => x.OwnerUserId == user.Id)
            .OrderByDescending(x => x.Active).ThenBy(x => x.DueDay).ThenBy(x => x.Name).ToListAsync(cancellationToken));
    }

    private static async Task<IResult> CreatePlannedExpense(
        PlannedExpenseRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var parsed = await ParsePlannedExpense(request, user.Id, database, cancellationToken);
        if (parsed.Error is not null) return parsed.Error;
        database.PlannedExpenses.Add(parsed.Value!);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/planned-expenses/{parsed.Value!.Id}", parsed.Value);
    }

    private static async Task<IResult> UpdatePlannedExpense(
        Guid plannedExpenseId,
        PlannedExpenseRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var existing = await database.PlannedExpenses.SingleOrDefaultAsync(
            x => x.Id == plannedExpenseId && x.OwnerUserId == user.Id, cancellationToken);
        if (existing is null) return HttpResults.Problem(404, "Not found", "Planned expense was not found");
        var parsed = await ParsePlannedExpense(request, user.Id, database, cancellationToken);
        if (parsed.Error is not null) return parsed.Error;
        var value = parsed.Value!;
        existing.AccountId = value.AccountId; existing.CategoryId = value.CategoryId; existing.Name = value.Name;
        existing.Kind = value.Kind; existing.Cadence = value.Cadence; existing.AmountCents = value.AmountCents;
        existing.DueDay = value.DueDay; existing.DueMonth = value.DueMonth;
        existing.IncludeInLimit = value.IncludeInLimit; existing.Active = value.Active;
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(existing);
    }

    private static async Task<IResult> ApplyCurrentPlannedExpenses(
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var service = new BudgetService(database, timeProvider);
        var (period, _, _) = await service.EnsureDefaultsAsync(user.Id, DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime), cancellationToken);
        var plans = await database.PlannedExpenses.Where(x => x.OwnerUserId == user.Id && x.Active)
            .OrderBy(x => x.DueDay).ThenBy(x => x.Name).ToListAsync(cancellationToken);
        var existing = (await database.PlannedExpenseApplications.Where(x => x.OwnerUserId == user.Id && x.PeriodId == period.Id)
            .Select(x => x.PlannedExpenseId).ToListAsync(cancellationToken)).ToHashSet();
        var applied = 0; var skipped = 0;
        foreach (var plan in plans)
        {
            var occurredOn = BudgetService.OccurrenceDate(period, plan);
            if (occurredOn is null || existing.Contains(plan.Id)) { skipped++; continue; }
            var entry = new BudgetTransaction
            {
                OwnerUserId = user.Id, PeriodId = period.Id, AccountId = plan.AccountId, CategoryId = plan.CategoryId,
                PlannedExpenseId = plan.Id, OccurredOn = occurredOn.Value, Description = plan.Name,
                AmountCents = plan.AmountCents, IncludeInLimit = plan.IncludeInLimit,
            };
            database.Transactions.Add(entry);
            await database.SaveChangesAsync(cancellationToken);
            database.LedgerEntries.Add(new BudgetLedgerEntry
            {
                OwnerUserId = user.Id,
                PeriodId = period.Id,
                CategoryId = plan.CategoryId,
                Kind = BudgetValues.Expense,
                OccurredOn = occurredOn.Value,
                Description = plan.Name,
                AmountCents = plan.AmountCents,
                OrdinaryImpactCents = plan.IncludeInLimit ? -plan.AmountCents : 0,
                Source = "planned_expense",
                SourceRecordId = plan.Id,
                LegacyTransactionId = entry.Id,
            });
            database.PlannedExpenseApplications.Add(new PlannedExpenseApplication
            {
                OwnerUserId = user.Id, PlannedExpenseId = plan.Id, PeriodId = period.Id, TransactionId = entry.Id,
            });
            await database.Accounts.Where(x => x.Id == plan.AccountId && x.OwnerUserId == user.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(x => x.BalanceCents, x => x.BalanceCents - plan.AmountCents), cancellationToken);
            applied++;
        }
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { applied, skipped });
    }

    private static async Task<IResult> CreateTransaction(
        CreateTransactionRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Description) || request.AmountCents <= 0)
            return HttpResults.Problem(422, "Validation failed", "Description and a positive amount are required");
        var occurredOn = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        if (!string.IsNullOrWhiteSpace(request.OccurredOn) && !DateOnly.TryParseExact(
                request.OccurredOn, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out occurredOn))
            return HttpResults.Problem(400, "Invalid date", "Occurred date must use YYYY-MM-DD");
        var account = await database.Accounts.SingleOrDefaultAsync(
            x => x.Id == request.AccountId && x.OwnerUserId == user.Id, cancellationToken);
        if (account is null) return HttpResults.Problem(404, "Not found", "Budget account or category was not found");
        BudgetCategory? category = null;
        if (request.CategoryId.HasValue)
        {
            category = await database.Categories.SingleOrDefaultAsync(
                x => x.Id == request.CategoryId && x.OwnerUserId == user.Id, cancellationToken);
            if (category is null) return HttpResults.Problem(404, "Not found", "Budget account or category was not found");
        }
        var service = new BudgetService(database, timeProvider);
        var (period, _, _) = await service.EnsureDefaultsAsync(user.Id, occurredOn, cancellationToken);
        var entry = new BudgetTransaction
        {
            OwnerUserId = user.Id, PeriodId = period.Id, AccountId = account.Id, CategoryId = category?.Id,
            OccurredOn = occurredOn, Description = request.Description.Trim(), AmountCents = request.AmountCents,
            IncludeInLimit = category?.Behavior == BudgetValues.ExcludeFromLimit ? false : request.IncludeInLimit ?? true,
        };
        database.Transactions.Add(entry);
        account.BalanceCents -= request.AmountCents;
        await database.SaveChangesAsync(cancellationToken);
        database.LedgerEntries.Add(new BudgetLedgerEntry
        {
            OwnerUserId = user.Id,
            PeriodId = period.Id,
            CategoryId = category?.Id,
            Kind = BudgetValues.Expense,
            OccurredOn = occurredOn,
            Description = request.Description.Trim(),
            AmountCents = request.AmountCents,
            OrdinaryImpactCents = entry.IncludeInLimit ? -request.AmountCents : 0,
            Source = "compatibility_transaction",
            LegacyTransactionId = entry.Id,
        });
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/v1/budget/transactions/{entry.Id}", entry);
    }

    private static (string Name, string Color, string Behavior, IResult? Error) ValidateCategory(CategoryRequest request)
    {
        var name = request.Name?.Trim() ?? "";
        if (name.Length == 0) return ("", "", "", HttpResults.Problem(422, "Validation failed", "category name is required"));
        var color = string.IsNullOrWhiteSpace(request.Color) ? "#64748b" : request.Color.Trim();
        if (!HexColor().IsMatch(color)) return ("", "", "", HttpResults.Problem(422, "Validation failed", "category color must be a #RRGGBB value"));
        var behavior = string.IsNullOrWhiteSpace(request.Behavior) ? BudgetValues.IncludeInLimit : request.Behavior.Trim();
        if (behavior is not (BudgetValues.IncludeInLimit or BudgetValues.ExcludeFromLimit))
            return ("", "", "", HttpResults.Problem(422, "Validation failed", "category behavior is invalid"));
        return (name, color, behavior, null);
    }

    private static async Task<(PlannedExpense? Value, IResult? Error)> ParsePlannedExpense(
        PlannedExpenseRequest request, Guid ownerId, BudgetDbContext database, CancellationToken cancellationToken)
    {
        var name = request.Name?.Trim() ?? "";
        if (name.Length == 0) return (null, HttpResults.Problem(422, "Validation failed", "planned expense name is required"));
        if (request.AmountCents <= 0) return (null, HttpResults.Problem(422, "Validation failed", "planned expense amount must be positive"));
        var dueDay = request.DueDay == 0 ? 1 : request.DueDay;
        if (dueDay is < 1 or > 31) return (null, HttpResults.Problem(422, "Validation failed", "planned expense due day must be between 1 and 31"));
        var kind = string.IsNullOrWhiteSpace(request.Kind) ? BudgetValues.FixedCost : request.Kind;
        if (kind is not (BudgetValues.FixedCost or BudgetValues.Subscription))
            return (null, HttpResults.Problem(422, "Validation failed", "planned expense kind is invalid"));
        var cadence = string.IsNullOrWhiteSpace(request.Cadence) ? BudgetValues.Monthly : request.Cadence;
        if (cadence is not (BudgetValues.Monthly or BudgetValues.Yearly))
            return (null, HttpResults.Problem(422, "Validation failed", "planned expense cadence is invalid"));
        var dueMonth = cadence == BudgetValues.Yearly ? request.DueMonth : null;
        if (cadence == BudgetValues.Yearly && dueMonth is not (>= 1 and <= 12))
            return (null, HttpResults.Problem(422, "Validation failed", "yearly planned expenses require a due month between 1 and 12"));
        var accountExists = await database.Accounts.AnyAsync(x => x.Id == request.AccountId && x.OwnerUserId == ownerId, cancellationToken);
        if (!accountExists) return (null, HttpResults.Problem(422, "Validation failed", "account was not found"));
        BudgetCategory? category = null;
        if (request.CategoryId.HasValue)
        {
            category = await database.Categories.SingleOrDefaultAsync(
                x => x.Id == request.CategoryId && x.OwnerUserId == ownerId, cancellationToken);
            if (category is null) return (null, HttpResults.Problem(422, "Validation failed", "category was not found"));
        }
        return (new PlannedExpense
        {
            OwnerUserId = ownerId, AccountId = request.AccountId, CategoryId = category?.Id, Name = name,
            Kind = kind, Cadence = cadence, AmountCents = request.AmountCents, DueDay = dueDay, DueMonth = dueMonth,
            IncludeInLimit = category?.Behavior == BudgetValues.ExcludeFromLimit ? false : request.IncludeInLimit ?? true,
            Active = request.Active ?? true,
        }, null);
    }

    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColor();

    private sealed record UpdatePeriodRequest(long SpendingLimitCents, long OverspendCarryoverCents);
    private sealed record CategoryRequest(string? Name, string? Color, string? Behavior);
    private sealed record CreateTransactionRequest(Guid AccountId, Guid? CategoryId, string? OccurredOn, string? Description, long AmountCents, bool? IncludeInLimit);
    private sealed record PlannedExpenseRequest(Guid AccountId, Guid? CategoryId, string? Name, string? Kind, string? Cadence, long AmountCents, int DueDay, int? DueMonth, bool? IncludeInLimit, bool? Active);
}
