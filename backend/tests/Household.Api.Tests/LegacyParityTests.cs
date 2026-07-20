using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Household.Api.Tests;

public sealed class LegacyParityTests(LegacyParityFixture fixture) : IClassFixture<LegacyParityFixture>
{
    [Theory]
    [InlineData("/healthz")]
    [InlineData("/api/v1/identity/healthz")]
    [InlineData("/api/v1/budget/healthz")]
    public async Task Existing_health_contracts_remain_available(string path)
    {
        var response = await fixture.Client.GetAsync(path);

        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task Existing_session_and_budget_data_survive_cutover()
    {
        using var request = Authenticated(HttpMethod.Get, "/api/v1/users/me");
        var userResponse = await fixture.Client.SendAsync(request);
        var user = await userResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.OK, userResponse.StatusCode);
        Assert.Equal(LegacyParityFixture.AdminId, user.GetProperty("id").GetGuid());
        Assert.Equal("admin", user.GetProperty("role").GetString());

        using var summaryRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary");
        var summaryResponse = await fixture.Client.SendAsync(summaryRequest);
        var summary = await summaryResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.OK, summaryResponse.StatusCode);
        Assert.Equal(4_200, summary.GetProperty("spentInLimitCents").GetInt64());
        Assert.Equal(235_800, summary.GetProperty("remainingCents").GetInt64());
        Assert.Equal(995_800, summary.GetProperty("accountBalanceCents").GetInt64());

        using var plansRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/planned-expenses");
        var plansResponse = await fixture.Client.SendAsync(plansRequest);
        var plans = await plansResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.OK, plansResponse.StatusCode);
        Assert.Contains(plans.EnumerateArray(), plan =>
            plan.GetProperty("id").GetGuid() == LegacyParityFixture.PlannedExpenseId &&
            plan.GetProperty("amountCents").GetInt64() == 80_000);
    }

    [Fact]
    public async Task Existing_password_hash_supports_login_refresh_and_logout()
    {
        var loginResponse = await fixture.Client.PostAsJsonAsync("/api/v1/auth/authorize", new
        {
            username = "admin",
            password = "admin",
        });
        var login = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace(login.GetProperty("accessToken").GetString()));

        var refreshResponse = await fixture.Client.PostAsJsonAsync("/api/v1/auth/refresh", new
        {
            refreshToken = login.GetProperty("refreshToken").GetString(),
        });
        var refreshed = await refreshResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);

        var logoutResponse = await fixture.Client.PostAsJsonAsync("/api/v1/auth/logout", new
        {
            refreshToken = refreshed.GetProperty("refreshToken").GetString(),
        });
        Assert.Equal(HttpStatusCode.NoContent, logoutResponse.StatusCode);
    }

    [Fact]
    public async Task Existing_admin_contract_manages_modules_and_reads_audit()
    {
        using var modulesRequest = Authenticated(HttpMethod.Get, "/api/v1/modules");
        var modulesResponse = await fixture.Client.SendAsync(modulesRequest);
        Assert.Equal(HttpStatusCode.OK, modulesResponse.StatusCode);

        using var updateRequest = Authenticated(HttpMethod.Patch, "/api/v1/modules/active");
        updateRequest.Content = JsonContent.Create(new { moduleIds = new[] { LegacyParityFixture.BudgetModuleId } });
        var updateResponse = await fixture.Client.SendAsync(updateRequest);
        Assert.Equal(HttpStatusCode.NoContent, updateResponse.StatusCode);

        using var auditRequest = Authenticated(HttpMethod.Get, "/api/v1/audit/events?limit=10");
        var auditResponse = await fixture.Client.SendAsync(auditRequest);
        var events = await auditResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.OK, auditResponse.StatusCode);
        Assert.Contains(events.EnumerateArray(), item => item.GetProperty("action").GetString() == "set_active_modules");
    }

    [Fact]
    public async Task Identity_registration_listing_password_and_authorization_boundaries_are_preserved()
    {
        var registration = await fixture.Client.PutAsJsonAsync("/api/v1/users/", new
        {
            name = "new-user",
            email = "new-user@household.local",
            password = "initial-password",
        });
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);

        var pendingLogin = await fixture.Client.PostAsJsonAsync("/api/v1/auth/authorize", new
        {
            username = "new-user",
            password = "initial-password",
        });
        Assert.Equal(HttpStatusCode.Forbidden, pendingLogin.StatusCode);

        var anonymousUsers = await fixture.Client.GetAsync("/api/v1/users/");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousUsers.StatusCode);

        using var usersRequest = Authenticated(HttpMethod.Get, "/api/v1/users/");
        var usersResponse = await fixture.Client.SendAsync(usersRequest);
        var users = await usersResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.OK, usersResponse.StatusCode);
        Assert.Contains(users.EnumerateArray(), user =>
            user.GetProperty("name").GetString() == "new-user" &&
            user.GetProperty("status").GetString() == "pending");

        using var wrongPassword = Authenticated(HttpMethod.Put, "/api/v1/users/me/password");
        wrongPassword.Content = JsonContent.Create(new { currentPassword = "wrong", newPassword = "changed-password" });
        Assert.Equal(HttpStatusCode.Forbidden, (await fixture.Client.SendAsync(wrongPassword)).StatusCode);

        using var passwordRequest = Authenticated(HttpMethod.Put, "/api/v1/users/me/password");
        passwordRequest.Content = JsonContent.Create(new { currentPassword = "admin", newPassword = "changed-password" });
        Assert.Equal(HttpStatusCode.NoContent, (await fixture.Client.SendAsync(passwordRequest)).StatusCode);

        var changedLogin = await fixture.Client.PostAsJsonAsync("/api/v1/auth/authorize", new
        {
            username = "admin",
            password = "changed-password",
        });
        Assert.Equal(HttpStatusCode.OK, changedLogin.StatusCode);

        using var resetPassword = Authenticated(HttpMethod.Put, "/api/v1/users/me/password");
        resetPassword.Content = JsonContent.Create(new { currentPassword = "changed-password", newPassword = "admin" });
        Assert.Equal(HttpStatusCode.NoContent, (await fixture.Client.SendAsync(resetPassword)).StatusCode);
    }

    [Fact]
    public async Task Budget_write_contracts_and_planned_application_are_preserved_and_idempotent()
    {
        using var periodRequest = Authenticated(HttpMethod.Patch, "/api/v1/budget/periods/current");
        periodRequest.Content = JsonContent.Create(new { spendingLimitCents = 300_000, overspendCarryoverCents = 5_000 });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(periodRequest)).StatusCode);

        using var categoryRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/categories");
        categoryRequest.Content = JsonContent.Create(new { name = "Transport", color = "#2563eb", behavior = "include_in_limit" });
        var categoryResponse = await fixture.Client.SendAsync(categoryRequest);
        var category = await categoryResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, categoryResponse.StatusCode);
        var categoryId = category.GetProperty("id").GetGuid();

        using var categoryUpdate = Authenticated(HttpMethod.Patch, $"/api/v1/budget/categories/{categoryId}");
        categoryUpdate.Content = JsonContent.Create(new { name = "Mobility", color = "#1d4ed8", behavior = "exclude_from_limit" });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(categoryUpdate)).StatusCode);

        using var transactionRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/transactions");
        transactionRequest.Content = JsonContent.Create(new
        {
            accountId = LegacyParityFixture.AccountId,
            categoryId,
            occurredOn = "2026-07-20",
            description = "Train",
            amountCents = 2_500,
            includeInLimit = true,
        });
        var transactionResponse = await fixture.Client.SendAsync(transactionRequest);
        var transaction = await transactionResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, transactionResponse.StatusCode);
        Assert.False(transaction.GetProperty("includeInLimit").GetBoolean());

        using var planRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/planned-expenses");
        planRequest.Content = JsonContent.Create(new
        {
            accountId = LegacyParityFixture.AccountId,
            categoryId = LegacyParityFixture.CategoryId,
            name = "Insurance",
            kind = "subscription",
            cadence = "monthly",
            amountCents = 12_000,
            dueDay = 31,
            includeInLimit = true,
            active = true,
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(planRequest)).StatusCode);

        using var firstApply = Authenticated(HttpMethod.Post, "/api/v1/budget/planned-expenses/apply-current");
        var firstApplyResponse = await fixture.Client.SendAsync(firstApply);
        var firstResult = await firstApplyResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.OK, firstApplyResponse.StatusCode);
        Assert.Equal(2, firstResult.GetProperty("applied").GetInt32());

        using var secondApply = Authenticated(HttpMethod.Post, "/api/v1/budget/planned-expenses/apply-current");
        var secondApplyResponse = await fixture.Client.SendAsync(secondApply);
        var secondResult = await secondApplyResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.OK, secondApplyResponse.StatusCode);
        Assert.Equal(0, secondResult.GetProperty("applied").GetInt32());
        Assert.Equal(2, secondResult.GetProperty("skipped").GetInt32());
    }

    [Fact]
    public async Task Update_contract_enforces_admin_and_reports_disabled_updater()
    {
        var anonymousStatus = await fixture.Client.GetAsync("/api/v1/updates/status");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousStatus.StatusCode);

        using var statusRequest = Authenticated(HttpMethod.Get, "/api/v1/updates/status");
        var statusResponse = await fixture.Client.SendAsync(statusRequest);
        var status = await statusResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        Assert.Equal("disabled", status.GetProperty("state").GetString());

        using var jobRequest = Authenticated(HttpMethod.Post, "/api/v1/updates/jobs");
        jobRequest.Content = JsonContent.Create(new { version = "v1.0.0", channel = "stable" });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await fixture.Client.SendAsync(jobRequest)).StatusCode);
    }

    private static HttpRequestMessage Authenticated(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.AccessToken);
        return request;
    }
}
