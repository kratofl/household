using System.Globalization;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public sealed class BudgetService(BudgetDbContext database, TimeProvider timeProvider)
{
    public async Task<BudgetSummary> SummaryAsync(Guid ownerId, CancellationToken cancellationToken)
    {
        var (period, categories, accounts) = await EnsureDefaultsAsync(
            ownerId, DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime), cancellationToken);
        var ledgerEntries = await database.LedgerEntries.AsNoTracking()
            .Include(x => x.Splits)
            .Where(x => x.OwnerUserId == ownerId && x.PeriodId == period.Id)
            .OrderByDescending(x => x.OccurredOn).ThenByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        var voidedIds = (await database.LedgerActions.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.Kind == BudgetValues.Void && ledgerEntries.Select(entry => entry.Id).Contains(x.LedgerEntryId))
            .Select(x => x.LedgerEntryId).ToListAsync(cancellationToken)).ToHashSet();
        var effectiveIds = BudgetLedgerState.EffectiveIds(
            ledgerEntries.Select(x => new LedgerStateEntry(x.Id, x.CorrectsEntryId)).ToList(), voidedIds).ToHashSet();
        var effectiveEntries = ledgerEntries.Where(x => effectiveIds.Contains(x.Id)).ToList();
        var applications = await database.PlannedExpenseApplications.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && x.PeriodId == period.Id)
            .Select(x => x.PlannedExpenseId).ToListAsync(cancellationToken);
        var applied = applications.ToHashSet();
        var planned = await database.PlannedExpenses.AsNoTracking().Where(x => x.OwnerUserId == ownerId)
            .OrderByDescending(x => x.Active).ThenBy(x => x.DueDay).ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);

        var spentByCategory = effectiveEntries.SelectMany(entry => entry.Splits.Select(split => new { entry.Kind, Split = split }))
            .Where(x => x.Split.CategoryId.HasValue && x.Kind is BudgetValues.Expense or BudgetValues.Refund)
            .GroupBy(x => x.Split.CategoryId!.Value)
            .ToDictionary(x => x.Key, x => x.Sum(item => item.Kind == BudgetValues.Refund ? -item.Split.AmountCents : item.Split.AmountCents));
        var categorySummaries = categories.Select(category => new CategorySummary(
            category.Id, category.Name, category.Color, category.Icon, category.Behavior, category.ArchivedAt is not null,
            spentByCategory.GetValueOrDefault(category.Id))).ToList();
        var spent = effectiveEntries.Where(x => x.Kind == BudgetValues.Expense && x.OrdinaryImpactCents < 0).Sum(x => x.AmountCents)
            - effectiveEntries.Where(x => x.Kind == BudgetValues.Refund && x.OrdinaryImpactCents > 0).Sum(x => x.AmountCents);
        var excluded = effectiveEntries.Where(x => x.Kind == BudgetValues.Expense && x.OrdinaryImpactCents == 0).Sum(x => x.AmountCents);
        var income = effectiveEntries.Where(x => x.Kind == BudgetValues.Income).Sum(x => x.AmountCents);
        var ordinaryImpact = effectiveEntries.Where(x => x.Kind != BudgetValues.Income).Sum(x => x.OrdinaryImpactCents);
        var incomePostingIds = effectiveEntries.Where(x => x.Kind == BudgetValues.Income && x.SourceRecordId.HasValue)
            .Select(x => x.SourceRecordId!.Value).ToHashSet();
        var varianceAllocations = await database.IncomeVarianceAllocations.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId && incomePostingIds.Contains(x.PostingId))
            .GroupBy(x => x.Destination).Select(x => new { Destination = x.Key, Amount = x.Sum(y => y.AmountCents) })
            .ToDictionaryAsync(x => x.Destination, x => x.Amount, cancellationToken);
        var settings = await database.Settings.AsNoTracking().SingleOrDefaultAsync(x => x.OwnerUserId == ownerId, cancellationToken);
        var availability = BudgetAvailability.Calculate(
            income,
            ordinaryImpact,
            settings?.BufferRule ?? BudgetValues.FixedBuffer,
            settings?.BufferAmountCents ?? 0,
            settings?.BufferPercentageBasisPoints ?? 0,
            varianceAllocations.GetValueOrDefault(BudgetValues.Buffer),
            varianceAllocations.GetValueOrDefault(BudgetValues.Savings),
            varianceAllocations.GetValueOrDefault(BudgetValues.Investment));
        var plannedSummaries = planned.Select(item => new PlannedExpenseSummary(
            item.Id, item.OwnerUserId, item.AccountId, item.CategoryId, item.Name, item.Kind, item.Cadence,
            item.AmountCents, item.DueDay, item.DueMonth, item.IncludeInLimit, item.Active,
            item.CreatedAt, item.UpdatedAt, applied.Contains(item.Id))).ToList();
        return new BudgetSummary(period, categorySummaries, spent, excluded,
            availability.OrdinaryAvailableCents,
            accounts.Sum(x => x.BalanceCents), accounts, plannedSummaries,
            income, availability.FundedBufferCents, availability.MaximumOrdinaryCents,
            availability.OrdinaryAvailableCents, ledgerEntries);
    }

    public async Task<(BudgetPeriod Period, List<BudgetCategory> Categories, List<BudgetAccount> Accounts)> EnsureDefaultsAsync(
        Guid ownerId,
        DateOnly date,
        CancellationToken cancellationToken)
    {
        var period = await database.Periods
            .Where(x => x.OwnerUserId == ownerId && x.StartDate <= date && x.EndDate >= date)
            .OrderByDescending(x => x.StartDate)
            .FirstOrDefaultAsync(cancellationToken);
        var preferredStartDay = await database.Settings.AsNoTracking()
            .Where(x => x.OwnerUserId == ownerId)
            .Select(x => (int?)x.PreferredPeriodStartDay)
            .SingleOrDefaultAsync(cancellationToken) ?? 1;
        var selected = period is null
            ? BudgetPeriodCalendar.ForDate(date, preferredStartDay)
            : new BudgetPeriodRange(period.StartDate, period.EndDate, period.PreferredStartDay);
        var start = selected.Start;
        var end = selected.End;
        var name = start.ToString("MMMM yyyy", CultureInfo.InvariantCulture);
        if (period is null)
        {
            await database.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO budget.periods (owner_user_id, name, start_date, end_date, preferred_start_day, spending_limit_cents)
                VALUES ({ownerId}, {name}, {start}, {end}, {selected.PreferredStartDay}, 240000)
                ON CONFLICT (owner_user_id, start_date) DO NOTHING;
                """, cancellationToken);
        }
        foreach (var category in DefaultCategories)
        {
            await database.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO budget.categories (owner_user_id, name, color, behavior, protected)
                VALUES ({ownerId}, {category.Name}, {category.Color}, {category.Behavior}, {category.Protected})
                ON CONFLICT (owner_user_id, name) DO NOTHING;
                """, cancellationToken);
        }
        await database.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO budget.accounts (owner_user_id, name, balance_cents)
            VALUES ({ownerId}, {"Girokonto"}, 0)
            ON CONFLICT (owner_user_id, name) DO NOTHING;
            """, cancellationToken);

        period ??= await database.Periods.SingleAsync(
            x => x.OwnerUserId == ownerId && x.StartDate == start, cancellationToken);
        var categories = await database.Categories.Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.Protected).ThenBy(x => x.Name).ToListAsync(cancellationToken);
        var accounts = await database.Accounts.Where(x => x.OwnerUserId == ownerId)
            .OrderBy(x => x.Name).ToListAsync(cancellationToken);
        return (period, categories, accounts);
    }

    public static DateOnly? OccurrenceDate(BudgetPeriod period, PlannedExpense planned)
    {
        if (!planned.Active) return null;
        if (planned.Cadence == BudgetValues.Yearly && planned.DueMonth != period.StartDate.Month) return null;
        if (planned.Cadence is not (BudgetValues.Monthly or BudgetValues.Yearly)) return null;
        var day = Math.Clamp(planned.DueDay, 1, period.EndDate.Day);
        return new DateOnly(period.StartDate.Year, period.StartDate.Month, day);
    }

    private static readonly (string Name, string Color, string Behavior, bool Protected)[] DefaultCategories =
    [
        ("Fixkosten", "#2563eb", BudgetValues.IncludeInLimit, false),
        ("Lebensmittel", "#16a34a", BudgetValues.IncludeInLimit, false),
        ("Flexibel", "#f97316", BudgetValues.IncludeInLimit, false),
        ("Sparen", "#7c3aed", BudgetValues.IncludeInLimit, false),
        ("Nicht speichern", "#64748b", BudgetValues.ExcludeFromLimit, true),
    ];
}
