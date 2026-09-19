using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class MerchantHttpTests(LegacyParityFixture fixture) : IClassFixture<LegacyParityFixture>
{
    private LegacyParityFixture Fixture { get; } = fixture;

    [Fact]
    public async Task Catalog_merchants_are_shared_and_own_merchants_stay_private()
    {
        using HttpClient client = this.Fixture.Client;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.MerchantAccessToken);

        // The catalog ships with the app, so a brand new user already has REWE and its logo.
        MerchantView rewe = Assert.Single(await this.Merchants(client), merchant => merchant.Name == "REWE");
        Assert.True(rewe.Catalog);
        Assert.Equal("rewe", rewe.LogoKey);
        Assert.Equal("#CC071E", rewe.Color);

        // An own merchant joins the same list and stays without a logo until the user gives it one.
        using HttpResponseMessage created = await client.PostAsJsonAsync("/api/v1/budget/merchants", new SaveMerchant("Bäckerei Schmitt"));
        MerchantView bakery = await Read<MerchantView>(created);
        Assert.False(bakery.Catalog);
        Assert.Null(bakery.LogoKey);
        Assert.Null(bakery.Color);
        Assert.Contains(await this.Merchants(client), merchant => merchant.Id == bakery.Id);

        using HttpClient other = this.Fixture.Client;
        other.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.MerchantIntruderAccessToken);
        IReadOnlyList<MerchantView> foreign = await this.Merchants(other);
        Assert.DoesNotContain(foreign, merchant => merchant.Id == bakery.Id);
        Assert.Contains(foreign, merchant => merchant.Name == "REWE");

        using HttpClient anonymous = this.Fixture.Client;
        using HttpResponseMessage unauthorized = await anonymous.GetAsync("/api/v1/budget/merchants");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);
    }

    [Fact]
    public async Task An_expense_records_the_merchant_and_refuses_a_foreign_one()
    {
        using HttpClient client = this.Fixture.Client;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.MerchantAccessToken);
        MerchantView rewe = Assert.Single(await this.Merchants(client), merchant => merchant.Name == "REWE");

        using HttpResponseMessage categoryResponse = await client.PostAsJsonAsync("/api/v1/budget/monthly/categories", new SaveMonthlyCategory("Lebensmittel"));
        MonthlyCategoryRow category = await Read<MonthlyCategoryRow>(categoryResponse);
        using HttpResponseMessage plan = await client.PutAsJsonAsync("/api/v1/budget/monthly/plan",
            new SaveMonthlyPlan(0, new MonthlyPlan(300000, 0, 0, [], [new(category.Id, 50000)]), 0, "Europe/Berlin"));
        Assert.Equal(HttpStatusCode.OK, plan.StatusCode);

        using HttpResponseMessage booked = await client.PostAsJsonAsync("/api/v1/budget/monthly/expenses",
            new AddMonthlyExpense("groceries-at-rewe", new(2026, 7, 12), "Wocheneinkauf", category.Id, 4211, null) { MerchantId = rewe.Id });
        Assert.Equal(rewe.Id, (await Read<MonthlyExpense>(booked)).MerchantId);

        using HttpResponseMessage state = await client.GetAsync("/api/v1/budget/monthly/");
        MonthlyBudgetState reloaded = await Read<MonthlyBudgetState>(state);
        Assert.Equal(rewe.Id, Assert.Single(reloaded.Entries, entry => entry.Expense.Description == "Wocheneinkauf").Expense.MerchantId);

        // Another user's merchant is not selectable, even by guessing its id.
        using HttpClient other = this.Fixture.Client;
        other.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.MerchantIntruderAccessToken);
        using HttpResponseMessage secretResponse = await other.PostAsJsonAsync("/api/v1/budget/merchants", new SaveMerchant("Geheimladen"));
        MerchantView secret = await Read<MerchantView>(secretResponse);
        using HttpResponseMessage foreign = await client.PostAsJsonAsync("/api/v1/budget/monthly/expenses",
            new AddMonthlyExpense("groceries-foreign", new(2026, 7, 13), "Fremd", category.Id, 100, null) { MerchantId = secret.Id });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, foreign.StatusCode);
    }

    [Fact]
    public async Task Admins_publish_merchants_for_everyone_and_users_only_for_themselves()
    {
        using HttpClient admin = this.Fixture.Client;
        admin.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.AccessToken);
        using HttpResponseMessage published = await admin.PostAsJsonAsync("/api/v1/budget/merchants", new SaveMerchant("Hofladen Meier", true));
        MerchantView shared = await Read<MerchantView>(published);
        Assert.True(shared.Catalog);

        using HttpClient user = this.Fixture.Client;
        user.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.MerchantAccessToken);
        Assert.Contains(await this.Merchants(user), merchant => merchant.Id == shared.Id);

        // A published merchant belongs to everyone, so only an admin may rename or retire it.
        using HttpResponseMessage denied = await user.PatchAsJsonAsync($"/api/v1/budget/merchants/{shared.Id}", new SaveMerchant("Geklaut"));
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        using HttpResponseMessage refused = await user.PostAsJsonAsync("/api/v1/budget/merchants", new SaveMerchant("Fuer alle", true));
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);

        // Its own merchant the user renames and archives freely.
        using HttpResponseMessage created = await user.PostAsJsonAsync("/api/v1/budget/merchants", new SaveMerchant("Kiosk"));
        MerchantView own = await Read<MerchantView>(created);
        using HttpResponseMessage edited = await user.PatchAsJsonAsync($"/api/v1/budget/merchants/{own.Id}",
            new SaveMerchant("Kiosk am Park") { Archived = true });
        MerchantView renamed = await Read<MerchantView>(edited);
        Assert.Equal("Kiosk am Park", renamed.Name);
        Assert.True(renamed.Archived);

        // The admin does not reach into the user's own merchants either.
        using HttpResponseMessage foreign = await admin.PatchAsJsonAsync($"/api/v1/budget/merchants/{own.Id}", new SaveMerchant("Fremd"));
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);

        using HttpResponseMessage relabelled = await admin.PatchAsJsonAsync($"/api/v1/budget/merchants/{shared.Id}", new SaveMerchant("Hofladen Meier & Sohn"));
        Assert.Equal("Hofladen Meier & Sohn", (await Read<MerchantView>(relabelled)).Name);
    }

    private async Task<IReadOnlyList<MerchantView>> Merchants(HttpClient client)
    {
        using HttpResponseMessage response = await client.GetAsync("/api/v1/budget/merchants");
        return await Read<List<MerchantView>>(response);
    }

    private static async Task<T> Read<T>(HttpResponseMessage response) where T : class
    {
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return await response.Content.ReadFromJsonAsync<T>() ?? throw new InvalidOperationException("Missing response.");
    }
}
