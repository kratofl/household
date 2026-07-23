using System.Text.RegularExpressions;
using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static partial class BudgetSetupEndpoints
{
    public static RouteGroupBuilder MapBudgetSetupEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapGet("/setup", GetSetup);
        budget.MapPut("/setup", PutSetup);
        budget.MapGet("/settings", GetSetup);
        budget.MapPatch("/settings", PatchSettings);
        return budget;
    }

    private static async Task<IResult> GetSetup(
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        return Results.Ok(await ProjectAsync(user.Id, database, cancellationToken));
    }

    private static Task<IResult> PutSetup(
        BudgetSetupRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        BudgetService budgetService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken) =>
        Configure(request, includeInitialValues: true, context, identity, database, budgetService, timeProvider, cancellationToken);

    private static Task<IResult> PatchSettings(
        BudgetSetupRequest request,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        BudgetService budgetService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken) =>
        Configure(request, includeInitialValues: false, context, identity, database, budgetService, timeProvider, cancellationToken);

    private static async Task<IResult> Configure(
        BudgetSetupRequest request,
        bool includeInitialValues,
        HttpContext context,
        IIdentityAccess identity,
        BudgetDbContext database,
        BudgetService budgetService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        if (Validate(request) is { } validationError) return validationError;

        var currency = request.BaseCurrency.Trim().ToUpperInvariant();
        var settings = await database.Settings.SingleOrDefaultAsync(x => x.OwnerUserId == user.Id, cancellationToken);
        var currencyLocked = await HasFinancialData(user.Id, database, cancellationToken);
        if (settings is not null && currencyLocked && settings.BaseCurrency != currency)
            return HttpResults.Problem(409, "Base currency locked", "Base currency cannot change after financial data exists");

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var isFirstSetup = settings?.SetupCompletedAt is null;
        settings ??= new BudgetSettings { OwnerUserId = user.Id };
        if (settings.Id == Guid.Empty) database.Settings.Add(settings);
        settings.BaseCurrency = currency;
        settings.PreferredPeriodStartDay = request.PreferredPeriodStartDay;
        settings.BufferRule = request.BufferRule;
        settings.BufferAmountCents = request.BufferRule == BudgetValues.FixedBuffer ? request.BufferAmountCents : 0;
        settings.BufferPercentageBasisPoints = request.BufferRule == BudgetValues.PercentageBuffer
            ? request.BufferPercentageBasisPoints
            : 0;
        settings.DefaultBufferDisposition = request.DefaultBufferDisposition ?? settings.DefaultBufferDisposition;
        settings.SetupCompletedAt ??= DateTime.SpecifyKind(timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Unspecified);
        await database.SaveChangesAsync(cancellationToken);

        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        if (includeInitialValues && isFirstSetup)
        {
            database.IncomePlans.AddRange((request.IncomePlans ?? []).Select(plan =>
                InitialIncomePlanVersion(plan, user.Id, today)));
            database.OpeningAllocations.AddRange((request.OpeningAllocations ?? []).Where(item => item.AmountCents > 0).Select(item =>
                new BudgetOpeningAllocation
                {
                    OwnerUserId = user.Id,
                    Kind = item.Kind,
                    Name = item.Name?.Trim() ?? "",
                    AmountCents = item.AmountCents,
                    OccurredOn = today,
                }));
            await database.SaveChangesAsync(cancellationToken);
        }

        await budgetService.EnsureDefaultsAsync(user.Id, today, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(await ProjectAsync(user.Id, database, cancellationToken));
    }

    private static async Task<BudgetSetupState> ProjectAsync(
        Guid ownerId,
        BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var settings = await database.Settings.AsNoTracking().SingleOrDefaultAsync(x => x.OwnerUserId == ownerId, cancellationToken);
        var incomePlans = await database.IncomePlans.AsNoTracking().Where(
                x => x.OwnerUserId == ownerId && x.Active && x.EffectiveTo == null)
            .OrderBy(x => x.Name).Select(x => new InitialIncomePlan(x.Id, x.Name, x.AmountCents)).ToListAsync(cancellationToken);
        var openingAllocations = await database.OpeningAllocations.AsNoTracking().Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.OccurredOn).ThenBy(x => x.Name)
            .Select(x => new OpeningAllocation(x.Id, x.Kind, x.Name, x.AmountCents, x.OccurredOn)).ToListAsync(cancellationToken);
        return new BudgetSetupState(
            settings?.SetupCompletedAt is not null,
            settings?.BaseCurrency ?? "EUR",
            await HasFinancialData(ownerId, database, cancellationToken),
            settings?.PreferredPeriodStartDay ?? 1,
            settings?.BufferRule ?? BudgetValues.FixedBuffer,
            settings?.BufferAmountCents ?? 0,
            settings?.BufferPercentageBasisPoints ?? 0,
            settings?.DefaultBufferDisposition ?? BudgetValues.Retain,
            incomePlans,
            openingAllocations);
    }

    private static async Task<bool> HasFinancialData(Guid ownerId, BudgetDbContext database, CancellationToken cancellationToken) =>
        await database.Transactions.AnyAsync(x => x.OwnerUserId == ownerId, cancellationToken) ||
        await database.PlannedExpenses.AnyAsync(x => x.OwnerUserId == ownerId, cancellationToken) ||
        await database.IncomePlans.AnyAsync(x => x.OwnerUserId == ownerId, cancellationToken) ||
        await database.OpeningAllocations.AnyAsync(x => x.OwnerUserId == ownerId, cancellationToken);

    private static BudgetIncomePlan InitialIncomePlanVersion(InitialIncomePlanRequest plan, Guid ownerId, DateOnly today)
    {
        var seriesId = Guid.NewGuid();
        return new BudgetIncomePlan
        {
            Id = seriesId,
            SeriesId = seriesId,
            OwnerUserId = ownerId,
            Name = plan.Name.Trim(),
            AmountCents = plan.AmountCents,
            Cadence = BudgetValues.Monthly,
            IntervalUnit = BudgetValues.Month,
            IntervalCount = 1,
            StartDate = today,
            EffectiveFrom = today,
        };
    }

    private static IResult? Validate(BudgetSetupRequest request)
    {
        if (!CurrencyCode().IsMatch(request.BaseCurrency?.Trim() ?? ""))
            return Invalid("Base currency must be a three-letter ISO code");
        if (request.PreferredPeriodStartDay is < 1 or > 31)
            return Invalid("Preferred period start day must be between 1 and 31");
        if (request.BufferRule is not (BudgetValues.FixedBuffer or BudgetValues.PercentageBuffer))
            return Invalid("Buffer rule must be fixed or percentage");
        if (request.BufferAmountCents < 0 || request.BufferPercentageBasisPoints is < 0 or > 10000)
            return Invalid("Buffer values are outside the supported range");
        if (request.DefaultBufferDisposition is not null &&
            request.DefaultBufferDisposition is not ("retain" or "ordinary" or "savings" or "investment"))
            return Invalid("Default buffer disposition is invalid");
        if ((request.IncomePlans ?? []).Any(x => string.IsNullOrWhiteSpace(x.Name) || x.AmountCents <= 0))
            return Invalid("Income plans need a name and positive amount");
        if ((request.OpeningAllocations ?? []).Any(x => x.Kind is not ("buffer" or "savings" or "investment") || x.AmountCents < 0))
            return Invalid("Opening allocations need a supported kind and non-negative amount");
        return null;
    }

    private static IResult Invalid(string detail) => HttpResults.Problem(422, "Validation failed", detail);
    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");

    [GeneratedRegex("^[A-Za-z]{3}$")]
    private static partial Regex CurrencyCode();
}

public sealed record BudgetSetupRequest(
    string BaseCurrency,
    int PreferredPeriodStartDay,
    string BufferRule,
    long BufferAmountCents,
    int BufferPercentageBasisPoints,
    string? DefaultBufferDisposition,
    IReadOnlyList<InitialIncomePlanRequest>? IncomePlans,
    IReadOnlyList<OpeningAllocationRequest>? OpeningAllocations);

public sealed record InitialIncomePlanRequest(string Name, long AmountCents);
public sealed record OpeningAllocationRequest(string Kind, string? Name, long AmountCents);
public sealed record InitialIncomePlan(Guid Id, string Name, long AmountCents);
public sealed record OpeningAllocation(Guid Id, string Kind, string Name, long AmountCents, DateOnly OccurredOn);
public sealed record BudgetSetupState(
    bool Completed,
    string BaseCurrency,
    bool BaseCurrencyLocked,
    int PreferredPeriodStartDay,
    string BufferRule,
    long BufferAmountCents,
    int BufferPercentageBasisPoints,
    string DefaultBufferDisposition,
    IReadOnlyList<InitialIncomePlan> IncomePlans,
    IReadOnlyList<OpeningAllocation> OpeningAllocations);
