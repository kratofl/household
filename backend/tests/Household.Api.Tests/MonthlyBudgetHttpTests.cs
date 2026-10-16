using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class MonthlyBudgetHttpTests(LegacyParityFixture fixture) : IClassFixture<LegacyParityFixture>
{
    private LegacyParityFixture Fixture { get; } = fixture;

    [Fact]
    public async Task Monthly_workflow_preserves_sources_history_ownership_and_retry_safety()
    {
        using HttpClient client = this.Fixture.Client;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.FreshAccessToken);
        using HttpResponseMessage categoryResponse = await client.PostAsJsonAsync("/api/v1/budget/monthly/categories", new SaveMonthlyCategory("Tanken"));
        MonthlyCategoryRow category = await Read<MonthlyCategoryRow>(categoryResponse);
        MonthlyPlan plan = new(280000, 20000, 100000,
            [new(Guid.NewGuid(), "Rent", 50000, "fixed", null, null),
             new(Guid.NewGuid(), "Monthly", 4297, "monthly", null, null),
             new(Guid.NewGuid(), "Credit card", 3600, "yearly", 9, 1),
             new(Guid.NewGuid(), "Amazon", 6900, "yearly", 10, 25)], [new(category.Id, 18000)]);
        using HttpResponseMessage setup = await client.PutAsJsonAsync("/api/v1/budget/monthly/plan", new SaveMonthlyPlan(0, plan, 0, "Europe/Berlin"));
        MonthlyBudgetState initial = await Read<MonthlyBudgetState>(setup);
        Assert.Equal(87703, initial.Summary?.FunRemainingCents);
        Assert.Equal(84103, initial.Forecast.Single(period => period.Start.Month == 9).FunCents);
        Assert.Equal(80803, initial.Forecast.Single(period => period.Start.Month == 10).FunCents);

        AddMonthlyExpense fuel = new("fuel", new(2026, 7, 15), "Aral", category.Id, 9740, null);
        using HttpResponseMessage fuelResponse = await client.PostAsJsonAsync("/api/v1/budget/monthly/expenses", fuel);
        MonthlyExpense savedFuel = await Read<MonthlyExpense>(fuelResponse);
        using HttpResponseMessage repeated = await client.PostAsJsonAsync("/api/v1/budget/monthly/expenses", fuel);
        Assert.Equal(savedFuel.Id, (await Read<MonthlyExpense>(repeated)).Id);
        using HttpResponseMessage wrongRetry = await client.PostAsJsonAsync("/api/v1/budget/monthly/expenses", fuel with { AmountCents = 10 });
        Assert.Equal(HttpStatusCode.Conflict, wrongRetry.StatusCode);

        MonthlyBudgetState afterFuel = await this.State(client);
        Assert.Equal(8260, Assert.Single(afterFuel.Summary?.Categories ?? []).RemainingCents);
        Assert.Equal(87703, afterFuel.Summary?.FunRemainingCents);

        AddMonthlyExpense purchase = new("saving-a", new(2026, 7, 20), "Purchase", category.Id, 80000,
            [new("savings", null, 80000)]);
        HttpResponseMessage[] competing = await Task.WhenAll(
            client.PostAsJsonAsync("/api/v1/budget/monthly/expenses", purchase),
            client.PostAsJsonAsync("/api/v1/budget/monthly/expenses", purchase with { RequestKey = "saving-b" }));
        try
        {
            Assert.Single(competing, response => response.StatusCode == HttpStatusCode.OK);
            Assert.Single(competing, response => response.StatusCode == HttpStatusCode.Conflict);
        }
        finally { foreach (HttpResponseMessage response in competing) response.Dispose(); }
        MonthlyBudgetState afterSaving = await this.State(client);
        Assert.Equal(20000, afterSaving.Summary?.SavingsBalanceCents);
        Assert.Equal(87703, afterSaving.Summary?.FunRemainingCents);

        using HttpResponseMessage correction = await client.PostAsJsonAsync("/api/v1/budget/monthly/expenses",
            fuel with { RequestKey = "correct-fuel", AmountCents = 10000, CorrectsId = savedFuel.Id });
        MonthlyExpense correctedFuel = await Read<MonthlyExpense>(correction);
        using HttpResponseMessage refund = await client.PostAsJsonAsync($"/api/v1/budget/monthly/expenses/{correctedFuel.Id}/refunds",
            new RefundMonthlyExpense("refund-fuel", new(2026, 7, 23), 3000));
        MonthlyExpense savedRefund = await Read<MonthlyExpense>(refund);
        Assert.Equal(11000, Assert.Single((await this.State(client)).Summary?.Categories ?? []).RemainingCents);
        using HttpResponseMessage voidRefund = await client.PostAsJsonAsync($"/api/v1/budget/monthly/expenses/{savedRefund.Id}/void", new VoidMonthlyExpense("void-refund"));
        Assert.Equal(HttpStatusCode.OK, voidRefund.StatusCode);

        using HttpResponseMessage change = await client.PutAsJsonAsync("/api/v1/budget/monthly/plan",
            new SaveMonthlyPlan(1, plan with { SavingsCents = 90000 }, 0, "Europe/Berlin"));
        MonthlyBudgetState pending = await Read<MonthlyBudgetState>(change);
        Assert.Equal(100000, pending.CurrentPlan?.SavingsCents);
        Assert.Equal(90000, pending.NextPlan?.SavingsCents);
        Assert.Equal(87703, pending.Summary?.FunRemainingCents);
        using HttpResponseMessage stale = await client.PutAsJsonAsync("/api/v1/budget/monthly/plan", new SaveMonthlyPlan(1, plan, 0, "Europe/Berlin"));
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        using HttpResponseMessage cancel = await client.DeleteAsync("/api/v1/budget/monthly/plan/pending?revision=2");
        Assert.Null((await Read<MonthlyBudgetState>(cancel)).NextPlan);

        using HttpClient other = this.Fixture.Client;
        other.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.LedgerAccessToken);
        using HttpResponseMessage foreignVoid = await other.PostAsJsonAsync($"/api/v1/budget/monthly/expenses/{correctedFuel.Id}/void", new VoidMonthlyExpense("foreign"));
        Assert.Equal(HttpStatusCode.NotFound, foreignVoid.StatusCode);
        Assert.Empty((await this.State(other)).Entries);
        using HttpClient anonymous = this.Fixture.Client;
        using HttpResponseMessage unauthorized = await anonymous.GetAsync("/api/v1/budget/monthly/");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);
    }

    [Fact]
    public async Task Plan_can_overwrite_the_running_period_unless_it_unfunds_recorded_expenses()
    {
        using HttpClient client = this.Fixture.Client;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.SplitAccessToken);
        using HttpResponseMessage categoryResponse = await client.PostAsJsonAsync("/api/v1/budget/monthly/categories", new SaveMonthlyCategory("Einkauf"));
        MonthlyCategoryRow category = await Read<MonthlyCategoryRow>(categoryResponse);
        MonthlyPlan plan = new(300000, 0, 0, [], [new(category.Id, 50000)]);
        using HttpResponseMessage setup = await client.PutAsJsonAsync("/api/v1/budget/monthly/plan", new SaveMonthlyPlan(0, plan, 0, "Europe/Berlin"));
        Assert.Equal(250000, (await Read<MonthlyBudgetState>(setup)).Summary?.FunRemainingCents);

        using HttpResponseMessage expense = await client.PostAsJsonAsync("/api/v1/budget/monthly/expenses",
            new AddMonthlyExpense("current-period-groceries", new(2026, 7, 10), "Markt", category.Id, 20000, null));
        Assert.Equal(HttpStatusCode.OK, expense.StatusCode);

        // The running period is rewritten in place, so the raise shows up now instead of next month.
        using HttpResponseMessage raise = await client.PutAsJsonAsync("/api/v1/budget/monthly/plan",
            new SaveMonthlyPlan(1, plan with { IncomeCents = 400000 }, 0, "Europe/Berlin", true));
        MonthlyBudgetState applied = await Read<MonthlyBudgetState>(raise);
        Assert.Equal(400000, applied.CurrentPlan?.IncomeCents);
        Assert.Null(applied.NextPlan);
        Assert.Equal(350000, applied.Summary?.FunRemainingCents);
        Assert.Equal(30000, Assert.Single(applied.Summary?.Categories ?? []).RemainingCents);

        // Dropping the reserve the recorded expense was paid from is refused.
        using HttpResponseMessage unfunded = await client.PutAsJsonAsync("/api/v1/budget/monthly/plan",
            new SaveMonthlyPlan(2, plan with { IncomeCents = 400000, Reserves = [] }, 0, "Europe/Berlin", true));
        Assert.Equal(HttpStatusCode.Conflict, unfunded.StatusCode);
        Assert.Equal(2, (await this.State(client)).Revision);
    }

    [Fact]
    public async Task Category_appearance_is_assigned_persisted_validated_and_user_owned()
    {
        using HttpClient client = this.Fixture.Client;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.TimelineAccessToken);
        List<MonthlyCategoryRow> categories = [];
        for (int index = 0; index < 5; index++)
        {
            using HttpResponseMessage created = await client.PostAsJsonAsync("/api/v1/budget/monthly/categories", new SaveMonthlyCategory($"Color {index}"));
            categories.Add(await Read<MonthlyCategoryRow>(created));
        }
        Assert.Equal(5, categories.Select(category => category.Color).Distinct().Count());
        MonthlyCategoryRow category = categories[0];
        using HttpResponseMessage updated = await client.PatchAsJsonAsync($"/api/v1/budget/monthly/categories/{category.Id}",
            new SaveMonthlyCategory("Groceries", Color: "purple", Icon: "cart"));
        Assert.Equal("cart", (await Read<MonthlyCategoryRow>(updated)).Icon);
        // Older clients omit appearance during rename/archive; their requests must preserve it.
        using HttpResponseMessage archived = await client.PatchAsJsonAsync($"/api/v1/budget/monthly/categories/{category.Id}", new SaveMonthlyCategory("Food", true));
        Assert.Equal(HttpStatusCode.OK, archived.StatusCode);
        MonthlyCategoryRow saved = Assert.Single((await this.State(client)).Categories, row => row.Id == category.Id);
        Assert.Equal("purple", saved.Color);
        Assert.Equal("cart", saved.Icon);
        Assert.True(saved.Archived);
        using HttpResponseMessage restored = await client.PatchAsJsonAsync($"/api/v1/budget/monthly/categories/{category.Id}", new SaveMonthlyCategory("Food"));
        Assert.False((await Read<MonthlyCategoryRow>(restored)).Archived);
        using HttpResponseMessage invalid = await client.PatchAsJsonAsync($"/api/v1/budget/monthly/categories/{category.Id}", new SaveMonthlyCategory("Food", Color: "invalid"));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalid.StatusCode);
        using HttpResponseMessage invalidIcon = await client.PostAsJsonAsync("/api/v1/budget/monthly/categories", new SaveMonthlyCategory("Bad icon", Icon: "invalid"));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalidIcon.StatusCode);
        using HttpClient other = this.Fixture.Client;
        other.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.LedgerAccessToken);
        using HttpResponseMessage foreign = await other.PatchAsJsonAsync($"/api/v1/budget/monthly/categories/{category.Id}", new SaveMonthlyCategory("Foreign", Color: "blue"));
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
    }

    [Fact]
    public async Task History_lists_the_last_six_periods_oldest_first_as_they_closed()
    {
        using HttpClient client = this.Fixture.Client;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.IncomeAccessToken);
        using HttpResponseMessage groceriesResponse = await client.PostAsJsonAsync("/api/v1/budget/monthly/categories", new SaveMonthlyCategory("Lebensmittel"));
        MonthlyCategoryRow groceries = await Read<MonthlyCategoryRow>(groceriesResponse);
        using HttpResponseMessage leisureResponse = await client.PostAsJsonAsync("/api/v1/budget/monthly/categories", new SaveMonthlyCategory("Freizeit"));
        MonthlyCategoryRow leisure = await Read<MonthlyCategoryRow>(leisureResponse);
        // 3000 income - 500 groceries reserve leaves 2500 fun per period.
        MonthlyPlan plan = new(300000, 0, 0, [], [new(groceries.Id, 50000)]);
        this.Fixture.Clock.UtcNow = new DateTimeOffset(2026, 1, 15, 12, 0, 0, TimeSpan.Zero);
        try
        {
            using HttpResponseMessage setup = await client.PutAsJsonAsync("/api/v1/budget/monthly/plan", new SaveMonthlyPlan(0, plan, 0, "Europe/Berlin"));
            Assert.Equal(HttpStatusCode.OK, setup.StatusCode);
        }
        finally { this.Fixture.Clock.UtcNow = LegacyParityFixture.Now; }

        (DateOnly Date, Guid Category, long Cents)[] expenses =
        [
            (new(2026, 1, 10), leisure.Id, 10000),
            (new(2026, 2, 10), leisure.Id, 20000),
            (new(2026, 3, 10), leisure.Id, 30000),
            // April overspends fun and empties the reserve, so May starts 100 short.
            (new(2026, 4, 10), leisure.Id, 260000),
            (new(2026, 4, 12), groceries.Id, 50000),
            (new(2026, 5, 5), leisure.Id, 5000),
            (new(2026, 7, 10), leisure.Id, 12345),
        ];
        foreach ((DateOnly date, Guid category, long cents) in expenses)
        {
            using HttpResponseMessage added = await client.PostAsJsonAsync("/api/v1/budget/monthly/expenses",
                new AddMonthlyExpense($"history-{date:yyyy-MM-dd}-{cents}", date, "Ausgabe", category, cents, null));
            Assert.Equal(HttpStatusCode.OK, added.StatusCode);
        }

        MonthlyBudgetState current = await this.State(client);
        MonthlyPeriodResult[] lastSix =
            [
                new MonthlyPeriodResult(new(2026, 2, 1), new(2026, 2, 28), 250000, 230000),
                new MonthlyPeriodResult(new(2026, 3, 1), new(2026, 3, 31), 250000, 220000),
                new MonthlyPeriodResult(new(2026, 4, 1), new(2026, 4, 30), 250000, -10000),
                new MonthlyPeriodResult(new(2026, 5, 1), new(2026, 5, 31), 240000, 235000),
                new MonthlyPeriodResult(new(2026, 6, 1), new(2026, 6, 30), 250000, 250000),
                new MonthlyPeriodResult(new(2026, 7, 1), new(2026, 7, 31), 250000, 237655),
            ];
        Assert.Equal(lastSix, current.History);
        Assert.Equal(237655, current.Summary?.FunRemainingCents);

        // Looking back ends the history at the selected period, valued as of that date.
        using HttpResponseMessage pastResponse = await client.GetAsync("/api/v1/budget/monthly/?date=2026-04-11");
        MonthlyBudgetState past = await Read<MonthlyBudgetState>(pastResponse);
        MonthlyPeriodResult[] untilApril =
            [
                new MonthlyPeriodResult(new(2026, 1, 1), new(2026, 1, 31), 250000, 240000),
                new MonthlyPeriodResult(new(2026, 2, 1), new(2026, 2, 28), 250000, 230000),
                new MonthlyPeriodResult(new(2026, 3, 1), new(2026, 3, 31), 250000, 220000),
                new MonthlyPeriodResult(new(2026, 4, 1), new(2026, 4, 30), 250000, -10000),
            ];
        Assert.Equal(untilApril, past.History);
    }

    [Fact]
    public async Task Subscriptions_name_a_merchant_and_a_description_but_only_merchants_the_user_can_see()
    {
        using HttpClient client = this.Fixture.Client;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.TimelineAccessToken);
        using HttpResponseMessage cinemaResponse = await client.PostAsJsonAsync("/api/v1/budget/merchants", new SaveMerchant("Kinoabo Müller"));
        MerchantView cinema = await Read<MerchantView>(cinemaResponse);
        using HttpClient other = this.Fixture.Client;
        other.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.LedgerAccessToken);
        using HttpResponseMessage foreignResponse = await other.PostAsJsonAsync("/api/v1/budget/merchants", new SaveMerchant("Fremdes Abo"));
        MerchantView foreign = await Read<MerchantView>(foreignResponse);

        MonthlyCost streaming = new(Guid.NewGuid(), "Streaming", 1399, "monthly", null, null, cinema.Id, "Familienabo");
        MonthlyPlan plan = new(300000, 0, 0, [streaming], []);
        using HttpResponseMessage rejected = await client.PutAsJsonAsync("/api/v1/budget/monthly/plan",
            new SaveMonthlyPlan(0, plan with { Costs = [streaming with { MerchantId = foreign.Id }] }, 0, "Europe/Berlin"));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, rejected.StatusCode);

        using HttpResponseMessage setup = await client.PutAsJsonAsync("/api/v1/budget/monthly/plan", new SaveMonthlyPlan(0, plan, 0, "Europe/Berlin"));
        MonthlyBudgetState state = await Read<MonthlyBudgetState>(setup);
        Assert.Equal(streaming, Assert.Single(state.CurrentPlan?.Costs ?? []));
        MonthlyCostDue due = Assert.Single(state.Summary?.Costs ?? []);
        Assert.Equal((cinema.Id, "Familienabo"), (due.MerchantId, due.Description));
    }

    private async Task<MonthlyBudgetState> State(HttpClient client)
    {
        using HttpResponseMessage response = await client.GetAsync("/api/v1/budget/monthly/");
        return await Read<MonthlyBudgetState>(response);
    }

    private static async Task<T> Read<T>(HttpResponseMessage response) where T : class
    {
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return await response.Content.ReadFromJsonAsync<T>() ?? throw new InvalidOperationException("Missing response.");
    }
}
