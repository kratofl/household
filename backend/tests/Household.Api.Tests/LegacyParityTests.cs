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

    private static HttpRequestMessage Authenticated(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", LegacyParityFixture.AccessToken);
        return request;
    }
}
