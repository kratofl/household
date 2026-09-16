using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Household.Api.Features.Budget;

public static class BudgetSavingsEndpoints
{
    public static RouteGroupBuilder MapBudgetSavingsEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapGet("/savings", List);
        budget.MapPost("/savings/purposes", CreatePurpose);
        budget.MapPost("/savings/goals", CreateGoal);
        budget.MapPost("/savings/contributions", Contribute);
        budget.MapPost("/savings/opening-values", Opening);
        budget.MapPost("/savings/purchases", Purchase);
        return budget;
    }

    private static async Task<IResult> List(
        string? asOf, HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        DateOnly selectedDate = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        if (!string.IsNullOrWhiteSpace(asOf) && !TryDate(asOf, out selectedDate)) return InvalidDate();
        return Results.Ok(await new BudgetSavingsProjector(database).LoadAsync(user.Id, selectedDate, cancellationToken));
    }

    private static async Task<IResult> CreateGoal(
        SavingsGoalRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, BudgetService budgetService, TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        string name = request.Name?.Trim() ?? "";
        if (name.Length == 0 || request.TargetAmountCents <= 0)
            return Invalid("Savings goal needs a name and positive target amount");
        if (request.PlanningMode is not (BudgetValues.DateDriven or BudgetValues.RateDriven))
            return Invalid("Planning mode must be date or rate");
        DateOnly today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        (BudgetPeriod _, List<BudgetCategory> _, List<BudgetAccount> _) = await budgetService.EnsureDefaultsAsync(user.Id, today, cancellationToken);
        int preferredStartDay = await database.Settings.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id)
            .Select(x => (int?)x.PreferredPeriodStartDay).SingleOrDefaultAsync(cancellationToken) ?? 1;

        DateOnly targetDate;
        long recurringContributionCents;
        try
        {
            if (request.PlanningMode == BudgetValues.DateDriven)
            {
                if (!TryDate(request.TargetDate, out targetDate) || targetDate < today)
                    return Invalid("A date-driven goal needs a current or future target date");
                recurringContributionCents = BudgetSavingsGoalPlanner.DateDriven(
                    request.TargetAmountCents, 0, 0, today, targetDate, today, preferredStartDay)
                    .PlannedContributionCents;
            }
            else
            {
                if (request.RecurringContributionCents is null or <= 0)
                    return Invalid("A rate-driven goal needs a positive recurring contribution");
                recurringContributionCents = request.RecurringContributionCents.Value;
                targetDate = BudgetSavingsGoalPlanner.ForecastDate(
                    request.TargetAmountCents, 0, recurringContributionCents, today, preferredStartDay);
            }
        }
        catch (ArgumentException error)
        {
            return Invalid(error.Message);
        }

        BudgetSavingsPurpose goal = new BudgetSavingsPurpose
        {
            OwnerUserId = user.Id,
            Name = name,
            TargetAmountCents = request.TargetAmountCents,
            PlanningMode = request.PlanningMode,
            PlanStartedOn = today,
            TargetDate = targetDate,
            RecurringContributionCents = recurringContributionCents,
        };
        database.SavingsPurposes.Add(goal);
        try
        {
            await database.SaveChangesAsync(cancellationToken);
            return Results.Created($"/api/v1/budget/savings/goals/{goal.Id}", goal);
        }
        catch (DbUpdateException)
        {
            return Invalid("Savings goal name must be unique");
        }
    }

    private static async Task<IResult> CreatePurpose(
        SavingsPurposeRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        string name = request.Name?.Trim() ?? "";
        if (name.Length == 0) return Invalid("Savings purpose name is required");
        BudgetSavingsPurpose purpose = new BudgetSavingsPurpose { OwnerUserId = user.Id, Name = name };
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
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        string? idempotencyKey = request.IdempotencyKey?.Trim();
        if (kind == BudgetValues.Contribution && string.IsNullOrWhiteSpace(idempotencyKey))
            return Invalid("Contribution idempotency key is required");
        if (idempotencyKey?.Length > 128) return Invalid("Contribution idempotency key is too long");
        if (idempotencyKey is not null)
        {
            BudgetSavingsContribution? existing = await database.SavingsContributions.AsNoTracking().Include(x => x.Allocations)
                .SingleOrDefaultAsync(x => x.OwnerUserId == user.Id && x.IdempotencyKey == idempotencyKey, cancellationToken);
            if (existing is not null) return Results.Ok(existing);
        }
        if (!TryDate(request.OccurredOn, out DateOnly occurredOn)) return InvalidDate();
        if (request.AmountCents <= 0 || string.IsNullOrWhiteSpace(request.Description))
            return Invalid("Savings funding needs a description and positive amount");
        IReadOnlyList<SavingsAllocationRequest> allocations = request.Allocations ?? [];
        if (allocations.Select(x => x.PurposeId).Distinct().Count() != allocations.Count)
            return Invalid("Each savings purpose can be allocated only once per contribution");
        if (allocations.Any(x => x.Mode is not ("fixed" or "percentage") || x.Value < 0 ||
                                 x.Mode == "percentage" && x.Value > 10_000))
            return Invalid("Savings allocation is invalid");
        HashSet<Guid> purposeIds = allocations.Select(x => x.PurposeId).ToHashSet();
        List<BudgetSavingsPurpose> foundPurposes = await database.SavingsPurposes.Where(
                x => x.OwnerUserId == user.Id && purposeIds.Contains(x.Id) &&
                     x.ArchivedAt == null && x.CompletedAt == null)
            .ToListAsync(cancellationToken);
        if (foundPurposes.Count != purposeIds.Count) return Invalid("Savings purpose was not found");

        var calculated = allocations.Select(x => new
        {
            Request = x,
            Amount = x.Mode == "fixed"
                ? x.Value
                : checked((long)Math.Floor((decimal)request.AmountCents * x.Value / 10_000m)),
        }).ToList();
        long allocatedTotal = calculated.Sum(x => x.Amount);
        if (allocatedTotal > request.AmountCents)
            return Invalid("Savings allocations cannot exceed funded value");
        (BudgetPeriod? period, List<BudgetCategory> _, List<BudgetAccount> _) = await budgetService.EnsureDefaultsAsync(user.Id, occurredOn, cancellationToken);
        if (kind == BudgetValues.Contribution)
        {
            BudgetSummary summary = await budgetService.SummaryAsync(user.Id, occurredOn, cancellationToken);
            if (request.AmountCents > Math.Max(0, summary.OrdinaryAvailableCents))
                return Invalid("Savings contribution cannot exceed funded ordinary availability");
        }
        SavingsProjection currentProjection = await new BudgetSavingsProjector(database).LoadAsync(
            user.Id, occurredOn, cancellationToken);
        foreach (var allocation in calculated)
        {
            BudgetSavingsPurpose purpose = foundPurposes.Single(x => x.Id == allocation.Request.PurposeId);
            long currentBalance = currentProjection.Purposes.Single(x => x.Id == purpose.Id).AllocatedCents;
            if (purpose.TargetAmountCents.HasValue &&
                checked(currentBalance + allocation.Amount) >= purpose.TargetAmountCents.Value)
                purpose.ContributionsPaused = true;
        }

        BudgetSavingsContribution contribution = new BudgetSavingsContribution
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
            BudgetSavingsContribution? winner = await database.SavingsContributions.AsNoTracking().Include(x => x.Allocations)
                .SingleOrDefaultAsync(x => x.OwnerUserId == user.Id && x.IdempotencyKey == idempotencyKey, cancellationToken);
            if (winner is not null) return Results.Ok(winner);
            throw;
        }
    }

    private static async Task<IResult> Purchase(
        SavingsPurchaseRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, BudgetService budgetService, TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        string key = request.IdempotencyKey?.Trim() ?? "";
        if (key.Length is 0 or > 128) return Invalid("Purchase idempotency key is required and must be at most 128 characters");
        BudgetSavingsPurchase? existing = await database.SavingsPurchases.AsNoTracking().Include(x => x.Funding)
            .SingleOrDefaultAsync(x => x.OwnerUserId == user.Id && x.IdempotencyKey == key, cancellationToken);
        if (existing is not null) return Results.Ok(existing);
        if (!TryDate(request.OccurredOn, out DateOnly occurredOn)) return InvalidDate();
        if (request.AmountCents <= 0 || string.IsNullOrWhiteSpace(request.Description))
            return Invalid("Purchase needs a description and positive amount");
        IReadOnlyList<SavingsPurchaseFundingRequest> funding = request.Funding ?? [];
        if (funding.Count == 0 || funding.Any(x => x.AmountCents <= 0) ||
            funding.Sum(x => x.AmountCents) != request.AmountCents)
            return Invalid("Explicit funding portions must cover the purchase exactly");
        if (funding.Any(x => x.Source is not (BudgetValues.Goal or BudgetValues.Ordinary)) ||
            funding.Count(x => x.Source == BudgetValues.Ordinary) > 1 ||
            funding.Any(x => x.Source == BudgetValues.Goal && !x.PurposeId.HasValue ||
                             x.Source == BudgetValues.Ordinary && x.PurposeId.HasValue))
            return Invalid("Purchase funding source is invalid");
        List<Guid> goalIds = funding.Where(x => x.Source == BudgetValues.Goal)
            .Select(x => x.PurposeId!.Value).ToList();
        if (goalIds.Distinct().Count() != goalIds.Count)
            return Invalid("Each goal can fund a purchase only once");

        SavingsProjection projection = await new BudgetSavingsProjector(database).LoadAsync(user.Id, occurredOn, cancellationToken);
        Dictionary<Guid, long> goalBalances = projection.Purposes.Where(x => goalIds.Contains(x.Id) && x.Status != "completed")
            .ToDictionary(x => x.Id, x => x.AllocatedCents);
        if (goalBalances.Count != goalIds.Count ||
            funding.Where(x => x.Source == BudgetValues.Goal)
                .Any(x => x.AmountCents > goalBalances.GetValueOrDefault(x.PurposeId!.Value)))
            return Invalid("A savings goal cannot fund more than its available allocation");
        long ordinaryFunding = funding.Where(x => x.Source == BudgetValues.Ordinary).Sum(x => x.AmountCents);
        if (ordinaryFunding > 0)
        {
            BudgetSummary summary = await budgetService.SummaryAsync(user.Id, occurredOn, cancellationToken);
            if (ordinaryFunding > Math.Max(0, summary.OrdinaryAvailableCents))
                return Invalid("Ordinary purchase funding exceeds available value");
        }

        (BudgetPeriod? period, List<BudgetCategory> _, List<BudgetAccount> _) = await budgetService.EnsureDefaultsAsync(user.Id, occurredOn, cancellationToken);
        BudgetLedgerEntry ledger = new BudgetLedgerEntry
        {
            OwnerUserId = user.Id,
            PeriodId = period.Id,
            Kind = BudgetValues.Expense,
            OccurredOn = occurredOn,
            Description = request.Description.Trim(),
            AmountCents = request.AmountCents,
            OrdinaryImpactCents = -ordinaryFunding,
            Source = "goal_purchase",
        };
        BudgetSavingsPurchase purchase = new BudgetSavingsPurchase
        {
            OwnerUserId = user.Id,
            PeriodId = period.Id,
            IdempotencyKey = key,
            OccurredOn = occurredOn,
            Description = request.Description.Trim(),
            AmountCents = request.AmountCents,
        };
        purchase.Funding.AddRange(funding.Select((x, index) => new BudgetSavingsPurchaseFunding
        {
            OwnerUserId = user.Id,
            Sequence = index,
            Source = x.Source!,
            PurposeId = x.PurposeId,
            AmountCents = x.AmountCents,
        }));

        await using IDbContextTransaction transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        database.LedgerEntries.Add(ledger);
        await database.SaveChangesAsync(cancellationToken);
        database.LedgerSplits.Add(new BudgetLedgerSplit
        {
            OwnerUserId = user.Id,
            LedgerEntryId = ledger.Id,
            CategoryNameSnapshot = "Uncategorized",
            CategoryColorSnapshot = "#64748b",
            CategoryIconSnapshot = "tag",
            AmountCents = request.AmountCents,
            OrdinaryImpactCents = -ordinaryFunding,
        });
        purchase.LedgerEntryId = ledger.Id;
        database.SavingsPurchases.Add(purchase);
        List<BudgetSavingsPurpose> goals = await database.SavingsPurposes.Where(x =>
            x.OwnerUserId == user.Id && goalIds.Contains(x.Id) && x.TargetAmountCents.HasValue)
            .ToListAsync(cancellationToken);
        foreach (BudgetSavingsPurpose? goal in goals)
        {
            long used = funding.Single(x => x.PurposeId == goal.Id).AmountCents;
            if (goalBalances[goal.Id] - used == 0)
            {
                goal.CompletedAt = DateTime.SpecifyKind(
                    timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Unspecified);
                goal.ContributionsPaused = true;
            }
        }
        try
        {
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            database.ChangeTracker.Clear();
            BudgetSavingsPurchase? winner = await database.SavingsPurchases.AsNoTracking().Include(x => x.Funding)
                .SingleOrDefaultAsync(x => x.OwnerUserId == user.Id && x.IdempotencyKey == key, cancellationToken);
            if (winner is not null) return Results.Ok(winner);
            throw;
        }
        return Results.Created($"/api/v1/budget/savings/purchases/{purchase.Id}", purchase);
    }

    private static bool TryDate(string? value, out DateOnly date) =>
        DateOnly.TryParseExact(value, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out date);
    private static IResult InvalidDate() => HttpResults.Problem(400, "Invalid date", "occurredOn must use YYYY-MM-DD");
    private static IResult Invalid(string detail) => HttpResults.Problem(422, "Validation failed", detail);
    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
}

public sealed record SavingsPurposeRequest(string? Name);
public sealed record SavingsGoalRequest(
    string? Name,
    long TargetAmountCents,
    string? PlanningMode,
    string? TargetDate,
    long? RecurringContributionCents);
public sealed record SavingsContributionRequest(
    string? IdempotencyKey,
    string? OccurredOn,
    string? Description,
    long AmountCents,
    IReadOnlyList<SavingsAllocationRequest>? Allocations);
public sealed record SavingsAllocationRequest(Guid PurposeId, string? Mode, long Value);
public sealed record SavingsPurchaseRequest(
    string? IdempotencyKey,
    string? OccurredOn,
    string? Description,
    long AmountCents,
    IReadOnlyList<SavingsPurchaseFundingRequest>? Funding);
public sealed record SavingsPurchaseFundingRequest(string? Source, Guid? PurposeId, long AmountCents);
