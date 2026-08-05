using System.Globalization;
using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

// Documented CSV export (docs/budget/csv-format.md): comma delimited, RFC 4180
// quoting, header row, ISO dates, invariant decimal amounts, stable identifiers
// so relationships between exported record types survive a round trip.
public static class BudgetExportEndpoints
{
    public static RouteGroupBuilder MapBudgetExportEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapGet("/export/{type}", Export);
        return budget;
    }

    private static async Task<IResult> Export(
        string type, HttpContext context, IIdentityAccess identity, BudgetDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var rows = type switch
        {
            "transactions" => await Transactions(database, user.Id, cancellationToken),
            "splits" => await Splits(database, user.Id, cancellationToken),
            "categories" => await Categories(database, user.Id, cancellationToken),
            "income-plans" => await IncomePlans(database, user.Id, cancellationToken),
            "commitments" => await Commitments(database, user.Id, cancellationToken),
            "savings-purposes" => await SavingsPurposes(database, user.Id, cancellationToken),
            "savings-contributions" => await SavingsContributions(database, user.Id, cancellationToken),
            "savings-allocations" => await SavingsAllocations(database, user.Id, cancellationToken),
            "investment-events" => await InvestmentEvents(database, user.Id, cancellationToken),
            _ => null,
        };
        if (rows is null) return HttpResults.Problem(404, "Not found", "Export type was not found");
        return Results.File(
            System.Text.Encoding.UTF8.GetBytes(BudgetCsv.Write(rows)), "text/csv", $"budget-{type}.csv");
    }

    private static async Task<List<IReadOnlyList<string>>> Transactions(
        BudgetDbContext database, Guid ownerId, CancellationToken cancellationToken)
    {
        var entries = await database.LedgerEntries.AsNoTracking().Include(x => x.Splits)
            .Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.OccurredOn).ThenBy(x => x.CreatedAt).ToListAsync(cancellationToken);
        var voided = (await database.LedgerActions.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.Kind == BudgetValues.Void)
            .Select(x => x.LedgerEntryId).ToListAsync(cancellationToken)).ToHashSet();
        var superseded = entries.Where(x => x.CorrectsEntryId.HasValue).Select(x => x.CorrectsEntryId!.Value).ToHashSet();
        var rows = new List<IReadOnlyList<string>>
        {
            new[]
            {
                "id", "kind", "status", "occurredOn", "description", "amount", "ordinaryImpact",
                "category", "merchant", "merchantNormalized", "brandKey", "source",
                "correctsEntryId", "relatedEntryId",
            },
        };
        rows.AddRange(entries.Select(entry => (IReadOnlyList<string>)new[]
        {
            entry.Id.ToString(),
            entry.Kind,
            voided.Contains(entry.Id) ? "voided" : superseded.Contains(entry.Id) ? "corrected" : "actual",
            Date(entry.OccurredOn),
            entry.Description,
            Amount(entry.AmountCents),
            Amount(entry.OrdinaryImpactCents),
            entry.Splits.Count == 1 ? entry.Splits[0].CategoryNameSnapshot : "",
            entry.MerchantRaw,
            entry.MerchantNormalized,
            entry.MerchantBrandKey ?? "",
            entry.Source,
            entry.CorrectsEntryId?.ToString() ?? "",
            entry.RelatedEntryId?.ToString() ?? "",
        }));
        return rows;
    }

    private static async Task<List<IReadOnlyList<string>>> Splits(
        BudgetDbContext database, Guid ownerId, CancellationToken cancellationToken)
    {
        var splits = await database.LedgerSplits.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.LedgerEntryId).ThenBy(x => x.CreatedAt).ToListAsync(cancellationToken);
        var rows = new List<IReadOnlyList<string>>
        {
            new[] { "id", "ledgerEntryId", "categoryId", "categoryName", "amount", "ordinaryImpact" },
        };
        rows.AddRange(splits.Select(split => (IReadOnlyList<string>)new[]
        {
            split.Id.ToString(),
            split.LedgerEntryId.ToString(),
            split.CategoryId?.ToString() ?? "",
            split.CategoryNameSnapshot,
            Amount(split.AmountCents),
            Amount(split.OrdinaryImpactCents),
        }));
        return rows;
    }

    private static async Task<List<IReadOnlyList<string>>> Categories(
        BudgetDbContext database, Guid ownerId, CancellationToken cancellationToken)
    {
        var categories = await database.Categories.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId).OrderBy(x => x.Name).ToListAsync(cancellationToken);
        var rows = new List<IReadOnlyList<string>>
        {
            new[] { "id", "name", "color", "icon", "behavior", "archived" },
        };
        rows.AddRange(categories.Select(category => (IReadOnlyList<string>)new[]
        {
            category.Id.ToString(), category.Name, category.Color, category.Icon,
            category.Behavior, category.ArchivedAt is null ? "false" : "true",
        }));
        return rows;
    }

    private static async Task<List<IReadOnlyList<string>>> IncomePlans(
        BudgetDbContext database, Guid ownerId, CancellationToken cancellationToken)
    {
        var versions = await database.IncomePlans.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.SeriesId).ThenBy(x => x.EffectiveFrom).ToListAsync(cancellationToken);
        var rows = new List<IReadOnlyList<string>>
        {
            new[]
            {
                "id", "seriesId", "name", "amount", "cadence", "intervalUnit", "intervalCount",
                "weekdays", "effectiveFrom", "effectiveTo", "automaticPosting", "active",
            },
        };
        rows.AddRange(versions.Select(version => (IReadOnlyList<string>)new[]
        {
            version.Id.ToString(), version.SeriesId.ToString(), version.Name, Amount(version.AmountCents),
            version.Cadence, version.IntervalUnit, version.IntervalCount.ToString(CultureInfo.InvariantCulture),
            version.Weekdays, Date(version.EffectiveFrom), version.EffectiveTo.HasValue ? Date(version.EffectiveTo.Value) : "",
            version.AutomaticPosting ? "true" : "false", version.Active ? "true" : "false",
        }));
        return rows;
    }

    private static async Task<List<IReadOnlyList<string>>> Commitments(
        BudgetDbContext database, Guid ownerId, CancellationToken cancellationToken)
    {
        var versions = await database.CommitmentPlans.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.SeriesId).ThenBy(x => x.EffectiveFrom).ToListAsync(cancellationToken);
        var rows = new List<IReadOnlyList<string>>
        {
            new[]
            {
                "id", "seriesId", "categoryId", "kind", "name", "amount", "cadence", "intervalUnit",
                "intervalCount", "weekdays", "effectiveFrom", "effectiveTo", "budgetingMode",
                "chargeFirstShortfall", "automaticPosting", "active",
            },
        };
        rows.AddRange(versions.Select(version => (IReadOnlyList<string>)new[]
        {
            version.Id.ToString(), version.SeriesId.ToString(), version.CategoryId?.ToString() ?? "",
            version.Kind, version.Name, Amount(version.AmountCents), version.Cadence, version.IntervalUnit,
            version.IntervalCount.ToString(CultureInfo.InvariantCulture), version.Weekdays,
            Date(version.EffectiveFrom), version.EffectiveTo.HasValue ? Date(version.EffectiveTo.Value) : "",
            version.BudgetingMode, version.ChargeFirstShortfall ? "true" : "false",
            version.AutomaticPosting ? "true" : "false", version.Active ? "true" : "false",
        }));
        return rows;
    }

    private static async Task<List<IReadOnlyList<string>>> SavingsPurposes(
        BudgetDbContext database, Guid ownerId, CancellationToken cancellationToken)
    {
        var purposes = await database.SavingsPurposes.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId).OrderBy(x => x.Name).ToListAsync(cancellationToken);
        var rows = new List<IReadOnlyList<string>>
        {
            new[] { "id", "name", "targetAmount", "planningMode", "targetDate", "contributionsPaused", "completedAt" },
        };
        rows.AddRange(purposes.Select(purpose => (IReadOnlyList<string>)new[]
        {
            purpose.Id.ToString(), purpose.Name,
            purpose.TargetAmountCents.HasValue ? Amount(purpose.TargetAmountCents.Value) : "",
            purpose.PlanningMode ?? "", purpose.TargetDate.HasValue ? Date(purpose.TargetDate.Value) : "",
            purpose.ContributionsPaused ? "true" : "false",
            purpose.CompletedAt?.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) ?? "",
        }));
        return rows;
    }

    private static async Task<List<IReadOnlyList<string>>> SavingsContributions(
        BudgetDbContext database, Guid ownerId, CancellationToken cancellationToken)
    {
        var contributions = await database.SavingsContributions.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.OccurredOn).ThenBy(x => x.CreatedAt).ToListAsync(cancellationToken);
        var rows = new List<IReadOnlyList<string>>
        {
            new[] { "id", "kind", "occurredOn", "description", "amount" },
        };
        rows.AddRange(contributions.Select(contribution => (IReadOnlyList<string>)new[]
        {
            contribution.Id.ToString(), contribution.Kind, Date(contribution.OccurredOn),
            contribution.Description, Amount(contribution.AmountCents),
        }));
        return rows;
    }

    private static async Task<List<IReadOnlyList<string>>> SavingsAllocations(
        BudgetDbContext database, Guid ownerId, CancellationToken cancellationToken)
    {
        var allocations = await database.SavingsAllocations.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.ContributionId).ThenBy(x => x.Id).ToListAsync(cancellationToken);
        var rows = new List<IReadOnlyList<string>>
        {
            new[] { "id", "contributionId", "purposeId", "amount" },
        };
        rows.AddRange(allocations.Select(allocation => (IReadOnlyList<string>)new[]
        {
            allocation.Id.ToString(), allocation.ContributionId.ToString(),
            allocation.PurposeId.ToString(), Amount(allocation.AmountCents),
        }));
        return rows;
    }

    private static async Task<List<IReadOnlyList<string>>> InvestmentEvents(
        BudgetDbContext database, Guid ownerId, CancellationToken cancellationToken)
    {
        var events = await database.InvestmentEvents.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.OccurredOn).ThenBy(x => x.CreatedAt).ToListAsync(cancellationToken);
        var rows = new List<IReadOnlyList<string>>
        {
            new[] { "id", "kind", "occurredOn", "description", "amount", "destination", "targetPurposeId" },
        };
        rows.AddRange(events.Select(item => (IReadOnlyList<string>)new[]
        {
            item.Id.ToString(), item.Kind, Date(item.OccurredOn), item.Description, Amount(item.AmountCents),
            item.Destination ?? "", item.TargetPurposeId?.ToString() ?? "",
        }));
        return rows;
    }

    private static string Date(DateOnly value) => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static string Amount(long cents)
    {
        var negative = cents < 0;
        var absolute = Math.Abs(cents);
        return $"{(negative ? "-" : "")}{absolute / 100}.{(absolute % 100).ToString("00", CultureInfo.InvariantCulture)}";
    }

    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
}
