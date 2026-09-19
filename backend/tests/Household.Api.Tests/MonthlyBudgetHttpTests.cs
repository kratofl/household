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
        MonthlyPlan plan = new(255173, 20000, 100000,
            [new(Guid.NewGuid(), "Papa", 50000, "fixed", null, null),
             new(Guid.NewGuid(), "Monthly", 6596, "monthly", null, null),
             new(Guid.NewGuid(), "Credit card", 3600, "yearly", 9, 1),
             new(Guid.NewGuid(), "Amazon", 8990, "yearly", 10, 25)], [new(category.Id, 18000)]);
        using HttpResponseMessage setup = await client.PutAsJsonAsync("/api/v1/budget/monthly/plan", new SaveMonthlyPlan(0, plan, 0, "Europe/Berlin"));
        MonthlyBudgetState initial = await Read<MonthlyBudgetState>(setup);
        Assert.Equal(60577, initial.Summary?.FunRemainingCents);
        Assert.Equal(56977, initial.Forecast.Single(period => period.Start.Month == 9).FunCents);
        Assert.Equal(51587, initial.Forecast.Single(period => period.Start.Month == 10).FunCents);

        AddMonthlyExpense fuel = new("fuel", new(2026, 7, 15), "Aral", category.Id, 12162, null);
        using HttpResponseMessage fuelResponse = await client.PostAsJsonAsync("/api/v1/budget/monthly/expenses", fuel);
        MonthlyExpense savedFuel = await Read<MonthlyExpense>(fuelResponse);
        using HttpResponseMessage repeated = await client.PostAsJsonAsync("/api/v1/budget/monthly/expenses", fuel);
        Assert.Equal(savedFuel.Id, (await Read<MonthlyExpense>(repeated)).Id);
        using HttpResponseMessage wrongRetry = await client.PostAsJsonAsync("/api/v1/budget/monthly/expenses", fuel with { AmountCents = 10 });
        Assert.Equal(HttpStatusCode.Conflict, wrongRetry.StatusCode);

        MonthlyBudgetState afterFuel = await this.State(client);
        Assert.Equal(5838, Assert.Single(afterFuel.Summary?.Categories ?? []).RemainingCents);
        Assert.Equal(60577, afterFuel.Summary?.FunRemainingCents);

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
        Assert.Equal(60577, afterSaving.Summary?.FunRemainingCents);

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
        Assert.Equal(60577, pending.Summary?.FunRemainingCents);
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
