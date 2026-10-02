using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Household.Api.Features.Budget;

public sealed record MonthlyForecast(DateOnly Start, DateOnly End, long FunCents, IReadOnlyList<MonthlyCostDue> Costs);
public sealed record MonthlyHistory(MonthlyExpense Expense, bool Voided);
public sealed record MonthlyBudgetState(DateOnly Today, long Revision, int StartDay, string Currency,
    string TimeZoneId, long OpeningSavingsCents, DateOnly? FirstDate, DateOnly NextStart,
    MonthlyPlan? CurrentPlan, MonthlyPlan? NextPlan, MonthlyPeriodSummary? Summary,
    IReadOnlyList<MonthlyForecast> Forecast, IReadOnlyList<MonthlyCategoryRow> Categories,
    IReadOnlyList<MonthlyHistory> Entries);

public sealed class MonthlyBudgetStore(BudgetDbContext database, TimeProvider timeProvider)
{
    private BudgetDbContext Database { get; } = database;
    private TimeProvider Clock { get; } = timeProvider;
    private static JsonSerializerOptions Json { get; } = new(JsonSerializerDefaults.Web);

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Json);
    public static T Deserialize<T>(string json) => JsonSerializer.Deserialize<T>(json, Json)
        ?? throw new InvalidOperationException("Invalid stored monthly budget data.");

    // All writes for one owner share a transaction lock, including the first plan and retries.
    public async Task<IDbContextTransaction> LockAsync(Guid owner, CancellationToken cancellationToken)
    {
        IDbContextTransaction transaction = await this.Database.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            await this.Database.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(hashtextextended({owner.ToString()}, 9142026))", cancellationToken);
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }

    public async Task<List<MonthlyPlanRow>> PlansAsync(Guid owner, CancellationToken cancellationToken) =>
        await this.Database.MonthlyPlans.AsNoTracking().Where(row => row.OwnerUserId == owner)
            .OrderBy(row => row.Revision).ToListAsync(cancellationToken);

    public async Task<List<MonthlyEntryRow>> EntriesAsync(Guid owner, CancellationToken cancellationToken) =>
        await this.Database.MonthlyEntries.AsNoTracking().Where(row => row.OwnerUserId == owner)
            .OrderBy(row => row.Sequence).ToListAsync(cancellationToken);

    public DateOnly Today(string zone) => DateOnly.FromDateTime(
        TimeZoneInfo.ConvertTime(this.Clock.GetUtcNow(), TimeZoneInfo.FindSystemTimeZoneById(zone)).DateTime);

    public static List<MonthlyExpense> EffectiveEntries(IReadOnlyList<MonthlyEntryRow> rows)
    {
        HashSet<Guid> voided = rows.Where(row => row.Kind == "void" && row.RelatedId.HasValue)
            .Select(row => row.RelatedId.GetValueOrDefault()).ToHashSet();
        return rows.Where(row => row.Kind != "void" && !voided.Contains(row.Id))
            .Select(row => Deserialize<MonthlyExpense>(row.ExpenseJson)).ToList();
    }

    public static List<MonthlyPlanVersion> Versions(IReadOnlyList<MonthlyPlanRow> plans) =>
        plans.Select(row => new MonthlyPlanVersion(row.Revision, row.EffectiveFrom,
            Deserialize<MonthlyPlan>(row.PlanJson))).ToList();

    public static MonthlyPlan ActivePlan(IReadOnlyList<MonthlyPlanRow> plans, DateOnly start) =>
        Deserialize<MonthlyPlan>(plans.Where(row => row.EffectiveFrom <= start)
            .OrderBy(row => row.EffectiveFrom).ThenBy(row => row.Revision).Last().PlanJson);

    public async Task<MonthlyBudgetState> StateAsync(Guid owner, DateOnly? selected, CancellationToken cancellationToken)
    {
        List<MonthlyPlanRow> plans = await this.PlansAsync(owner, cancellationToken);
        List<MonthlyCategoryRow> categories = await this.Database.MonthlyCategories.AsNoTracking()
            .Where(row => row.OwnerUserId == owner).OrderBy(row => row.Name).ToListAsync(cancellationToken);
        BudgetSettings? settings = await this.Database.Settings.AsNoTracking()
            .SingleOrDefaultAsync(row => row.OwnerUserId == owner, cancellationToken);
        int day = plans.FirstOrDefault()?.StartDay ?? settings?.PreferredPeriodStartDay ?? 1;
        string currency = plans.FirstOrDefault()?.Currency ?? settings?.BaseCurrency ?? "EUR";
        string zone = plans.FirstOrDefault()?.TimeZoneId ?? "Europe/Berlin";
        DateOnly today = this.Today(zone);
        BudgetPeriodRange current = BudgetPeriodCalendar.ForDate(today, day);
        DateOnly nextStart = current.End.AddDays(1);
        if (plans.Count == 0)
            return new(today, 0, day, currency, zone, 0, null, nextStart, null, null, null, [], categories, []);
        DateOnly first = plans[0].EffectiveFrom;
        DateOnly date = selected ?? today;
        if (date < first || date > today) throw new MonthlyBudgetConflict("date_outside_history");
        List<MonthlyEntryRow> rows = await this.EntriesAsync(owner, cancellationToken);
        List<MonthlyExpense> entries = EffectiveEntries(rows);
        List<MonthlyPlanVersion> versions = Versions(plans);
        MonthlyPeriodSummary summary = MonthlyBudgetCalculator.Project(versions, entries, date, day, plans[0].OpeningSavingsCents);
        List<MonthlyForecast> forecast = Forecast(plans, current.Start, day);
        HashSet<Guid> effectiveIds = entries.Select(entry => entry.Id).ToHashSet();
        MonthlyPlan active = ActivePlan(plans, current.Start);
        MonthlyPlan next = ActivePlan(plans, nextStart);
        bool changed = !System.Text.Json.Nodes.JsonNode.DeepEquals(
            System.Text.Json.Nodes.JsonNode.Parse(Serialize(active)), System.Text.Json.Nodes.JsonNode.Parse(Serialize(next)));
        return new(today, plans[^1].Revision, day, currency, zone, plans[0].OpeningSavingsCents, first,
            nextStart, active, changed ? next : null,
            summary, forecast, categories,
            rows.Where(row => row.Kind != "void").Select(row => new MonthlyHistory(
                Deserialize<MonthlyExpense>(row.ExpenseJson), !effectiveIds.Contains(row.Id))).Reverse().ToArray());
    }

    public static List<MonthlyForecast> Forecast(IReadOnlyList<MonthlyPlanRow> plans, DateOnly start, int startDay)
    {
        List<MonthlyForecast> result = [];
        BudgetPeriodRange period = BudgetPeriodCalendar.ForDate(start, startDay);
        for (int index = 0; index < 12; index++)
        {
            MonthlyPlan plan = ActivePlan(plans, period.Start);
            IReadOnlyList<MonthlyCostDue> costs = MonthlyBudgetCalculator.CostsDue(plan, period);
            result.Add(new(period.Start, period.End, plan.IncomeCents - plan.BufferCents - plan.SavingsCents -
                plan.Reserves.Sum(reserve => reserve.AmountCents) - costs.Sum(cost => cost.AmountCents), costs));
            period = BudgetPeriodCalendar.ForDate(period.End.AddDays(1), startDay);
        }
        return result;
    }
}
