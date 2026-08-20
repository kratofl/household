using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Household.Api.Features.Budget;

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
        Assert.Equal(-4_200, summary.GetProperty("remainingCents").GetInt64());
        Assert.Equal(0, summary.GetProperty("actualIncomeCents").GetInt64());
        Assert.Equal(995_800, summary.GetProperty("accountBalanceCents").GetInt64());

        using var plansRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/planned-expenses");
        var plansResponse = await fixture.Client.SendAsync(plansRequest);
        var plans = await plansResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.OK, plansResponse.StatusCode);
        Assert.Contains(plans.EnumerateArray(), plan =>
            plan.GetProperty("id").GetGuid() == LegacyParityFixture.PlannedExpenseId &&
            plan.GetProperty("amountCents").GetInt64() == 80_000);

        using var ledgerRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/ledger/entries");
        var ledger = await (await fixture.Client.SendAsync(ledgerRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(ledger.EnumerateArray(), entry =>
            entry.GetProperty("source").GetString() == "legacy_transaction" &&
            entry.GetProperty("ordinaryImpactCents").GetInt64() == -4_200);

        using var issuesRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/migration-issues");
        var issues = await (await fixture.Client.SendAsync(issuesRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(issues.EnumerateArray(), issue =>
            issue.GetProperty("code").GetString() == "legacy_account_balance_not_imported");
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

    [Fact]
    public async Task First_run_setup_creates_initial_values_and_future_period_changes_do_not_rewrite_history()
    {
        using var initialRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/setup", LegacyParityFixture.FreshAccessToken);
        var initialResponse = await fixture.Client.SendAsync(initialRequest);
        var initial = await initialResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.OK, initialResponse.StatusCode);
        Assert.False(initial.GetProperty("completed").GetBoolean());
        Assert.False(initial.GetProperty("baseCurrencyLocked").GetBoolean());

        using var setupRequest = Authenticated(HttpMethod.Put, "/api/v1/budget/setup", LegacyParityFixture.FreshAccessToken);
        setupRequest.Content = JsonContent.Create(new
        {
            baseCurrency = "EUR",
            preferredPeriodStartDay = 31,
            bufferRule = "percentage",
            bufferAmountCents = 0,
            bufferPercentageBasisPoints = 1_250,
            incomePlans = new[] { new { name = "Salary", amountCents = 320_000 } },
            openingAllocations = new[] { new { kind = "buffer", name = "Opening buffer", amountCents = 25_000 } },
        });
        var setupResponse = await fixture.Client.SendAsync(setupRequest);
        var setup = await setupResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.OK, setupResponse.StatusCode);
        Assert.True(setup.GetProperty("completed").GetBoolean());
        Assert.True(setup.GetProperty("baseCurrencyLocked").GetBoolean());
        Assert.Single(setup.GetProperty("incomePlans").EnumerateArray());
        Assert.Single(setup.GetProperty("openingAllocations").EnumerateArray());

        using var julyPeriodRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/periods/current?date=2026-07-20", LegacyParityFixture.FreshAccessToken);
        var julyResponse = await fixture.Client.SendAsync(julyPeriodRequest);
        var julyPeriod = await julyResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("2026-06-30", julyPeriod.GetProperty("startDate").GetString());
        Assert.Equal("2026-07-30", julyPeriod.GetProperty("endDate").GetString());
        Assert.Equal(31, julyPeriod.GetProperty("preferredStartDay").GetInt32());

        using var settingsRequest = Authenticated(HttpMethod.Patch, "/api/v1/budget/settings", LegacyParityFixture.FreshAccessToken);
        settingsRequest.Content = JsonContent.Create(new
        {
            baseCurrency = "EUR",
            preferredPeriodStartDay = 15,
            bufferRule = "fixed",
            bufferAmountCents = 20_000,
            bufferPercentageBasisPoints = 0,
        });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(settingsRequest)).StatusCode);

        using var historicalRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/periods/current?date=2026-07-20", LegacyParityFixture.FreshAccessToken);
        var historicalPeriod = await (await fixture.Client.SendAsync(historicalRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("2026-06-30", historicalPeriod.GetProperty("startDate").GetString());
        Assert.Equal(31, historicalPeriod.GetProperty("preferredStartDay").GetInt32());

        using var futureRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/periods/current?date=2026-08-20", LegacyParityFixture.FreshAccessToken);
        var futurePeriod = await (await fixture.Client.SendAsync(futureRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("2026-08-15", futurePeriod.GetProperty("startDate").GetString());
        Assert.Equal("2026-09-14", futurePeriod.GetProperty("endDate").GetString());
        Assert.Equal(15, futurePeriod.GetProperty("preferredStartDay").GetInt32());

        using var currencyRequest = Authenticated(HttpMethod.Patch, "/api/v1/budget/settings", LegacyParityFixture.FreshAccessToken);
        currencyRequest.Content = JsonContent.Create(new
        {
            baseCurrency = "USD",
            preferredPeriodStartDay = 15,
            bufferRule = "fixed",
            bufferAmountCents = 20_000,
            bufferPercentageBasisPoints = 0,
        });
        Assert.Equal(HttpStatusCode.Conflict, (await fixture.Client.SendAsync(currencyRequest)).StatusCode);
    }

    [Fact]
    public async Task Manual_ledger_income_and_expenses_need_no_account_and_drive_funded_availability()
    {
        using var incomeRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", LegacyParityFixture.LedgerAccessToken);
        incomeRequest.Content = JsonContent.Create(new
        {
            kind = "income",
            occurredOn = "2026-07-20",
            description = "Salary received",
            amountCents = 100_000,
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(incomeRequest)).StatusCode);

        using var expenseRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", LegacyParityFixture.LedgerAccessToken);
        expenseRequest.Content = JsonContent.Create(new
        {
            kind = "expense",
            occurredOn = "2026-07-20",
            description = "Groceries",
            amountCents = 25_000,
            affectsOrdinary = true,
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(expenseRequest)).StatusCode);

        using var excludedRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", LegacyParityFixture.LedgerAccessToken);
        excludedRequest.Content = JsonContent.Create(new
        {
            kind = "expense",
            occurredOn = "2026-07-20",
            description = "Protected purchase",
            amountCents = 3_000,
            affectsOrdinary = false,
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(excludedRequest)).StatusCode);

        using var summaryRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", LegacyParityFixture.LedgerAccessToken);
        var summary = await (await fixture.Client.SendAsync(summaryRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(100_000, summary.GetProperty("actualIncomeCents").GetInt64());
        Assert.Equal(25_000, summary.GetProperty("spentInLimitCents").GetInt64());
        Assert.Equal(3_000, summary.GetProperty("excludedSpentCents").GetInt64());
        Assert.Equal(75_000, summary.GetProperty("ordinaryAvailableCents").GetInt64());
        Assert.Equal(75_000, summary.GetProperty("remainingCents").GetInt64());

        using var entriesRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/ledger/entries", LegacyParityFixture.LedgerAccessToken);
        var entries = await (await fixture.Client.SendAsync(entriesRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3, entries.GetArrayLength());
        Assert.All(entries.EnumerateArray(), entry => Assert.Equal("manual", entry.GetProperty("source").GetString()));
    }

    [Fact]
    public async Task Category_versions_exact_splits_and_merchant_suggestions_preserve_history_without_financial_authority()
    {
        var foodId = await CreateCategory("Food", "#16a34a", "basket");
        var funId = await CreateCategory("Fun", "#7c3aed", "sparkles");

        using var entryRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", LegacyParityFixture.SplitAccessToken);
        entryRequest.Content = JsonContent.Create(new
        {
            kind = "expense",
            occurredOn = "2026-07-20",
            description = "Shared Disney purchase",
            merchant = "  Disney+ ",
            amountCents = 10_001,
            affectsOrdinary = true,
            splits = new object[]
            {
                new { categoryId = foodId, amountCents = 3_333, useRemaining = false, affectsOrdinary = true },
                new { categoryId = funId, amountCents = (long?)null, useRemaining = true, affectsOrdinary = false },
            },
        });
        var entryResponse = await fixture.Client.SendAsync(entryRequest);
        var entry = await entryResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, entryResponse.StatusCode);
        Assert.Equal("DISNEY PLUS", entry.GetProperty("merchantNormalized").GetString());
        Assert.Equal("disney-plus", entry.GetProperty("merchantBrandKey").GetString());
        Assert.Equal(-3_333, entry.GetProperty("ordinaryImpactCents").GetInt64());
        Assert.Equal([3_333L, 6_668L], entry.GetProperty("splits").EnumerateArray().Select(x => x.GetProperty("amountCents").GetInt64()));

        using var updateRequest = Authenticated(HttpMethod.Patch, $"/api/v1/budget/categories/{foodId}", LegacyParityFixture.SplitAccessToken);
        updateRequest.Content = JsonContent.Create(new
        {
            name = "Groceries",
            color = "#15803d",
            icon = "shopping-cart",
            behavior = "exclude_from_limit",
            archived = true,
        });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(updateRequest)).StatusCode);

        using var historyRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/ledger/entries", LegacyParityFixture.SplitAccessToken);
        var history = await (await fixture.Client.SendAsync(historyRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var historicalSplit = history[0].GetProperty("splits").EnumerateArray().Single(x => x.GetProperty("categoryId").GetGuid() == foodId);
        Assert.Equal("Food", historicalSplit.GetProperty("categoryNameSnapshot").GetString());
        Assert.Equal("#16a34a", historicalSplit.GetProperty("categoryColorSnapshot").GetString());
        Assert.Equal("basket", historicalSplit.GetProperty("categoryIconSnapshot").GetString());
        Assert.Equal(-3_333, historicalSplit.GetProperty("ordinaryImpactCents").GetInt64());

        using var archivedEntry = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", LegacyParityFixture.SplitAccessToken);
        archivedEntry.Content = JsonContent.Create(new
        {
            kind = "expense",
            occurredOn = "2026-07-21",
            description = "Should fail",
            amountCents = 100,
            categoryId = foodId,
            affectsOrdinary = true,
        });
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.Client.SendAsync(archivedEntry)).StatusCode);

        using var suggestionsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/merchants/suggestions?query=disney", LegacyParityFixture.SplitAccessToken);
        var suggestions = await (await fixture.Client.SendAsync(suggestionsRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(suggestions.GetProperty("merchants").EnumerateArray(), merchant =>
            merchant.GetProperty("brandKey").GetString() == "disney-plus");
        Assert.Contains(suggestions.GetProperty("categorySuggestions").EnumerateArray(), suggestion =>
            suggestion.GetProperty("categoryId").GetGuid() == funId || suggestion.GetProperty("categoryId").GetGuid() == foodId);

        async Task<Guid> CreateCategory(string name, string color, string icon)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/categories", LegacyParityFixture.SplitAccessToken);
            request.Content = JsonContent.Create(new { name, color, icon, behavior = "include_in_limit" });
            var response = await fixture.Client.SendAsync(request);
            var category = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return category.GetProperty("id").GetGuid();
        }
    }

    [Fact]
    public async Task Timeline_corrections_voids_refunds_and_expected_items_remain_auditable()
    {
        const string token = LegacyParityFixture.TimelineAccessToken;
        using var defaultsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        var defaults = await (await fixture.Client.SendAsync(defaultsRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var categoryId = defaults.GetProperty("categories")[0].GetProperty("id").GetGuid();
        var accountId = defaults.GetProperty("accounts")[0].GetProperty("id").GetGuid();

        var originalId = await PostExpense("Original expense", 10_000);
        using var correctionRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/ledger/entries/{originalId}/corrections", token);
        correctionRequest.Content = JsonContent.Create(new
        {
            reason = "Receipt showed a different total",
            description = "Corrected expense",
            occurredOn = "2026-07-20",
            amountCents = 12_000,
            categoryId,
            affectsOrdinary = true,
            merchant = "REWE",
        });
        var correctionResponse = await fixture.Client.SendAsync(correctionRequest);
        var correction = await correctionResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, correctionResponse.StatusCode);
        var correctionId = correction.GetProperty("id").GetGuid();

        using var refundRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/ledger/entries/{correctionId}/refunds", token);
        refundRequest.Content = JsonContent.Create(new { occurredOn = "2026-07-21", amountCents = 2_000, description = "Partial refund" });
        var refundResponse = await fixture.Client.SendAsync(refundRequest);
        var refund = await refundResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, refundResponse.StatusCode);
        Assert.Equal(correctionId, refund.GetProperty("relatedEntryId").GetGuid());
        Assert.Equal(2_000, refund.GetProperty("ordinaryImpactCents").GetInt64());

        var voidCandidateId = await PostExpense("Duplicate expense", 5_000);
        using var voidRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/ledger/entries/{voidCandidateId}/voids", token);
        voidRequest.Content = JsonContent.Create(new { reason = "Duplicate import" });
        Assert.Equal(HttpStatusCode.NoContent, (await fixture.Client.SendAsync(voidRequest)).StatusCode);

        using var planRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/planned-expenses", token);
        planRequest.Content = JsonContent.Create(new
        {
            accountId,
            categoryId,
            name = "Expected insurance",
            kind = "fixed_cost",
            cadence = "monthly",
            amountCents = 3_000,
            dueDay = 25,
            includeInLimit = true,
            active = true,
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(planRequest)).StatusCode);

        using var timelineRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/timeline", token);
        var timeline = await (await fixture.Client.SendAsync(timelineRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(timeline.EnumerateArray(), item => item.GetProperty("id").GetString() == originalId.ToString() && item.GetProperty("status").GetString() == "corrected");
        Assert.Contains(timeline.EnumerateArray(), item => item.GetProperty("id").GetString() == voidCandidateId.ToString() && item.GetProperty("status").GetString() == "voided");
        Assert.Contains(timeline.EnumerateArray(), item => item.GetProperty("entryType").GetString() == "expected" && item.GetProperty("description").GetString() == "Expected insurance");

        using var filteredRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/timeline?query=refund&kind=refund&status=actual&impact=included", token);
        var filtered = await (await fixture.Client.SendAsync(filteredRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Single(filtered.EnumerateArray());

        using var detailsRequest = Authenticated(HttpMethod.Get, $"/api/v1/budget/ledger/entries/{originalId}", token);
        var details = await (await fixture.Client.SendAsync(detailsRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(originalId, details.GetProperty("entry").GetProperty("id").GetGuid());
        Assert.Contains(details.GetProperty("auditHistory").GetProperty("corrections").EnumerateArray(), item =>
            item.GetProperty("id").GetGuid() == correctionId && item.GetProperty("changeReason").GetString() == "Receipt showed a different total");

        using var summaryRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        var summary = await (await fixture.Client.SendAsync(summaryRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(10_000, summary.GetProperty("spentInLimitCents").GetInt64());
        Assert.Equal(-10_000, summary.GetProperty("ordinaryAvailableCents").GetInt64());

        async Task<Guid> PostExpense(string description, long amountCents)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", token);
            request.Content = JsonContent.Create(new
            {
                kind = "expense", occurredOn = "2026-07-20", description, amountCents, categoryId, affectsOrdinary = true,
            });
            var response = await fixture.Client.SendAsync(request);
            var entry = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return entry.GetProperty("id").GetGuid();
        }
    }

    [Fact]
    public async Task Recurring_income_keeps_versioned_history_and_skips_paused_or_stopped_occurrences()
    {
        const string token = LegacyParityFixture.IncomeAccessToken;
        using var createRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/income-plans", token);
        createRequest.Content = JsonContent.Create(new
        {
            name = "Contract work", amountCents = 100_000, cadence = "custom", intervalUnit = "week",
            intervalCount = 2, weekdays = new[] { 1, 4 }, startDate = "2026-07-06",
        });
        var createResponse = await fixture.Client.SendAsync(createRequest);
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var seriesId = created.GetProperty("seriesId").GetGuid();

        using var pauseRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/income-plans/{seriesId}/pauses", token);
        pauseRequest.Content = JsonContent.Create(new { from = "2026-07-20", through = "2026-07-23", reason = "Client holiday" });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(pauseRequest)).StatusCode);

        using var occurrenceEdit = Authenticated(HttpMethod.Patch, $"/api/v1/budget/income-plans/{seriesId}", token);
        occurrenceEdit.Content = JsonContent.Create(new
        {
            scope = "occurrence", scheduledOn = "2026-07-09", occurredOn = "2026-07-10",
            amountCents = 120_000, reason = "Invoice paid a day later",
        });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(occurrenceEdit)).StatusCode);

        using var futureEdit = Authenticated(HttpMethod.Patch, $"/api/v1/budget/income-plans/{seriesId}", token);
        futureEdit.Content = JsonContent.Create(new
        {
            scope = "future", effectiveOn = "2026-08-03", amountCents = 150_000,
            reason = "New contract rate",
        });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(futureEdit)).StatusCode);

        using var stopRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/income-plans/{seriesId}/stop", token);
        stopRequest.Content = JsonContent.Create(new { effectiveOn = "2026-08-18", reason = "Contract ended" });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(stopRequest)).StatusCode);

        using var listRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/income-plans?from=2026-07-01&through=2026-09-30", token);
        var projection = await (await fixture.Client.SendAsync(listRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var plan = Assert.Single(
            projection.GetProperty("plans").EnumerateArray(),
            x => x.GetProperty("seriesId").GetGuid() == seriesId);
        Assert.Equal("2026-08-18", plan.GetProperty("stoppedOn").GetString());
        Assert.Equal(2, plan.GetProperty("versions").GetArrayLength());
        Assert.Equal("2026-08-02", plan.GetProperty("versions")[0].GetProperty("effectiveTo").GetString());

        var occurrences = projection.GetProperty("occurrences").EnumerateArray()
            .Where(x => x.GetProperty("seriesId").GetGuid() == seriesId).ToList();
        Assert.Equal(
            ["2026-07-06", "2026-07-10", "2026-08-03", "2026-08-06", "2026-08-17"],
            occurrences.Select(x => x.GetProperty("occurredOn").GetString()));
        Assert.Equal(100_000, occurrences[0].GetProperty("amountCents").GetInt64());
        Assert.True(occurrences[1].GetProperty("overridden").GetBoolean());
        Assert.Equal(120_000, occurrences[1].GetProperty("amountCents").GetInt64());
        Assert.All(occurrences.Skip(2), occurrence => Assert.Equal(150_000, occurrence.GetProperty("amountCents").GetInt64()));

        using var timelineRequest = Authenticated(
            HttpMethod.Get, "/api/v1/budget/timeline?kind=income&status=expected&origin=income_plan", token);
        var timeline = await (await fixture.Client.SendAsync(timelineRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(timeline.EnumerateArray(), item =>
            item.GetProperty("description").GetString() == "Contract work" &&
            item.GetProperty("occurredOn").GetString() == "2026-07-10" &&
            item.GetProperty("amountCents").GetInt64() == 120_000);
    }

    [Fact]
    public async Task Recurring_income_api_accepts_each_standard_cadence()
    {
        foreach (var cadence in new[] { "daily", "weekly", "monthly", "quarterly", "yearly" })
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/income-plans", LegacyParityFixture.IncomeAccessToken);
            request.Content = JsonContent.Create(new
            {
                name = $"{cadence} income", amountCents = 1_000, cadence, intervalCount = 1, startDate = "2026-07-01",
            });
            Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(request)).StatusCode);
        }
    }

    [Fact]
    public async Task Income_confirmation_routes_positive_variance_and_auto_posting_is_retry_safe()
    {
        const string token = LegacyParityFixture.IncomeConfirmationAccessToken;
        var shortfallSeries = await CreateIncomePlan("Variable salary", 100_000, false, "monthly", "2026-07-01");

        using var shortfallRequest = Authenticated(
            HttpMethod.Post, $"/api/v1/budget/income-plans/{shortfallSeries}/occurrences/2026-07-01/confirm", token);
        shortfallRequest.Content = JsonContent.Create(new { actualOn = "2026-07-02", actualAmountCents = 80_000 });
        var shortfallResponse = await fixture.Client.SendAsync(shortfallRequest);
        var shortfall = await shortfallResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, shortfallResponse.StatusCode);
        Assert.Equal(-20_000, shortfall.GetProperty("varianceCents").GetInt64());

        using var shortfallSummaryRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        var shortfallSummary = await (await fixture.Client.SendAsync(shortfallSummaryRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(80_000, shortfallSummary.GetProperty("actualIncomeCents").GetInt64());
        Assert.Equal(80_000, shortfallSummary.GetProperty("maximumOrdinaryCents").GetInt64());

        var surplusSeries = await CreateIncomePlan("Bonus", 100_000, false, "monthly", "2026-07-05");
        using var ruleRequest = Authenticated(HttpMethod.Put, $"/api/v1/budget/income-plans/{surplusSeries}/variance-rule", token);
        ruleRequest.Content = JsonContent.Create(new
        {
            mode = "percentage",
            routes = new[]
            {
                new { destination = "ordinary", value = 2_500, targetId = (Guid?)null },
                new { destination = "savings", value = 2_500, targetId = (Guid?)Guid.NewGuid() },
            },
        });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(ruleRequest)).StatusCode);

        var confirmationPath = $"/api/v1/budget/income-plans/{surplusSeries}/occurrences/2026-07-05/confirm";
        using var surplusRequest = Authenticated(HttpMethod.Post, confirmationPath, token);
        surplusRequest.Content = JsonContent.Create(new { actualOn = "2026-07-05", actualAmountCents = 120_000 });
        var surplusResponse = await fixture.Client.SendAsync(surplusRequest);
        var surplus = await surplusResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, surplusResponse.StatusCode);
        Assert.Equal(20_000, surplus.GetProperty("varianceCents").GetInt64());
        Assert.Contains(surplus.GetProperty("allocations").EnumerateArray(), x =>
            x.GetProperty("destination").GetString() == "ordinary" && x.GetProperty("amountCents").GetInt64() == 5_000);
        Assert.Contains(surplus.GetProperty("allocations").EnumerateArray(), x =>
            x.GetProperty("destination").GetString() == "savings" && x.GetProperty("amountCents").GetInt64() == 5_000);
        Assert.Contains(surplus.GetProperty("allocations").EnumerateArray(), x =>
            x.GetProperty("destination").GetString() == "buffer" && x.GetProperty("amountCents").GetInt64() == 10_000);

        using var retryRequest = Authenticated(HttpMethod.Post, confirmationPath, token);
        retryRequest.Content = JsonContent.Create(new { actualOn = "2026-07-05", actualAmountCents = 120_000 });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(retryRequest)).StatusCode);

        using var routedSummaryRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        var routedSummary = await (await fixture.Client.SendAsync(routedSummaryRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(200_000, routedSummary.GetProperty("actualIncomeCents").GetInt64());
        Assert.Equal(10_000, routedSummary.GetProperty("fundedBufferCents").GetInt64());
        Assert.Equal(185_000, routedSummary.GetProperty("maximumOrdinaryCents").GetInt64());
        Assert.Equal(2, routedSummary.GetProperty("ledgerEntries").EnumerateArray().Count(x =>
            x.GetProperty("source").GetString() == "income_confirmation"));

        var automaticSeries = await CreateIncomePlan("Daily payout", 1_000, true, "daily", "2026-07-19");
        using var autoRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/income-plans/auto-post?from=2026-07-19&through=2026-07-20", token);
        var autoResult = await (await fixture.Client.SendAsync(autoRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, autoResult.GetProperty("posted").GetInt32());
        using var autoRetryRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/income-plans/auto-post?from=2026-07-19&through=2026-07-20", token);
        var retryResult = await (await fixture.Client.SendAsync(autoRetryRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, retryResult.GetProperty("posted").GetInt32());

        using var timelineRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/timeline?kind=income", token);
        var timeline = await (await fixture.Client.SendAsync(timelineRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(timeline.EnumerateArray(), x =>
            x.GetProperty("entryType").GetString() == "expected" && x.GetProperty("status").GetString() == "confirmed");
        Assert.Contains(timeline.EnumerateArray(), x =>
            x.GetProperty("entryType").GetString() == "expected" && x.GetProperty("status").GetString() == "automatically_posted");
        Assert.Equal(2, timeline.EnumerateArray().Count(x =>
            x.GetProperty("entryType").GetString() == "actual" && x.GetProperty("origin").GetString() == "income_automatic"));

        async Task<Guid> CreateIncomePlan(string name, long amountCents, bool automaticPosting, string cadence, string startDate)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/income-plans", token);
            request.Content = JsonContent.Create(new
            {
                name, amountCents, cadence, intervalCount = 1, startDate, automaticPosting,
            });
            var response = await fixture.Client.SendAsync(request);
            var plan = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return plan.GetProperty("seriesId").GetGuid();
        }
    }

    [Fact]
    public async Task Commitments_share_versioned_scheduling_and_post_only_through_explicit_paths()
    {
        const string token = LegacyParityFixture.CommitmentAccessToken;
        using var defaultsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        var defaults = await (await fixture.Client.SendAsync(defaultsRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var categoryId = defaults.GetProperty("categories")[0].GetProperty("id").GetGuid();

        var seriesId = await CreateCommitment("Rent", 100_000, "fixed_cost", "monthly", "2026-07-31", false);
        using var occurrenceEdit = Authenticated(HttpMethod.Patch, $"/api/v1/budget/commitments/{seriesId}", token);
        occurrenceEdit.Content = JsonContent.Create(new
        {
            scope = "occurrence", scheduledOn = "2026-08-31", occurredOn = "2026-08-30",
            amountCents = 105_000, reason = "Landlord requested an earlier transfer",
        });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(occurrenceEdit)).StatusCode);

        using var futureEdit = Authenticated(HttpMethod.Patch, $"/api/v1/budget/commitments/{seriesId}", token);
        futureEdit.Content = JsonContent.Create(new
        {
            scope = "future", effectiveOn = "2026-09-30", kind = "subscription",
            amountCents = 120_000, reason = "Contract changed",
        });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(futureEdit)).StatusCode);

        using var pauseRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/commitments/{seriesId}/pauses", token);
        pauseRequest.Content = JsonContent.Create(new { from = "2026-10-01", through = "2026-10-31", reason = "Payment holiday" });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(pauseRequest)).StatusCode);
        using var stopRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/commitments/{seriesId}/stop", token);
        stopRequest.Content = JsonContent.Create(new { effectiveOn = "2026-11-01", reason = "Contract ended" });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(stopRequest)).StatusCode);

        using var confirmationRequest = Authenticated(
            HttpMethod.Post, $"/api/v1/budget/commitments/{seriesId}/occurrences/2026-07-31/confirm", token);
        confirmationRequest.Content = JsonContent.Create(new { actualOn = "2026-07-31", actualAmountCents = 99_000 });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(confirmationRequest)).StatusCode);
        using var retryConfirmation = Authenticated(
            HttpMethod.Post, $"/api/v1/budget/commitments/{seriesId}/occurrences/2026-07-31/confirm", token);
        retryConfirmation.Content = JsonContent.Create(new { actualOn = "2026-07-31", actualAmountCents = 99_000 });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(retryConfirmation)).StatusCode);

        using var projectionRequest = Authenticated(
            HttpMethod.Get, "/api/v1/budget/commitments?from=2026-07-01&through=2026-12-31", token);
        var projection = await (await fixture.Client.SendAsync(projectionRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var plan = Assert.Single(projection.GetProperty("plans").EnumerateArray(), x => x.GetProperty("seriesId").GetGuid() == seriesId);
        Assert.Equal(2, plan.GetProperty("versions").GetArrayLength());
        Assert.Equal("2026-09-29", plan.GetProperty("versions")[0].GetProperty("effectiveTo").GetString());
        var occurrences = projection.GetProperty("occurrences").EnumerateArray()
            .Where(x => x.GetProperty("seriesId").GetGuid() == seriesId).ToList();
        Assert.Equal(["2026-07-31", "2026-08-30", "2026-09-30"], occurrences.Select(x => x.GetProperty("occurredOn").GetString()));
        Assert.Equal("confirmed", occurrences[0].GetProperty("status").GetString());
        Assert.Equal(105_000, occurrences[1].GetProperty("amountCents").GetInt64());
        Assert.Equal("subscription", occurrences[2].GetProperty("kind").GetString());

        _ = await CreateCommitment("Auto utility", 2_000, "fixed_cost", "monthly", "2026-07-23", true);
        using var autoRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/commitments/auto-post?from=2026-07-23&through=2026-07-23", token);
        var autoResult = await (await fixture.Client.SendAsync(autoRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, autoResult.GetProperty("posted").GetInt32());
        using var autoRetryRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/commitments/auto-post?from=2026-07-23&through=2026-07-23", token);
        var autoRetry = await (await fixture.Client.SendAsync(autoRetryRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, autoRetry.GetProperty("posted").GetInt32());

        var matchSeries = await CreateCommitment("Matched utility", 3_000, "subscription", "monthly", "2026-07-24", false);
        using var ledgerRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", token);
        ledgerRequest.Content = JsonContent.Create(new
        {
            kind = "expense", occurredOn = "2026-07-24", description = "Utility debit",
            amountCents = 3_100, categoryId, affectsOrdinary = true,
        });
        var ledger = await (await fixture.Client.SendAsync(ledgerRequest)).Content.ReadFromJsonAsync<JsonElement>();
        using var matchRequest = Authenticated(
            HttpMethod.Post, $"/api/v1/budget/commitments/{matchSeries}/occurrences/2026-07-24/match", token);
        matchRequest.Content = JsonContent.Create(new { ledgerEntryId = ledger.GetProperty("id").GetGuid() });
        var matchResponse = await fixture.Client.SendAsync(matchRequest);
        var matched = await matchResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, matchResponse.StatusCode);
        Assert.Equal("matched", matched.GetProperty("postingMode").GetString());
        Assert.Equal(ledger.GetProperty("id").GetGuid(), matched.GetProperty("ledgerEntryId").GetGuid());

        using var timelineRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/timeline?origin=commitment_plan", token);
        var timeline = await (await fixture.Client.SendAsync(timelineRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(timeline.EnumerateArray(), x =>
            x.GetProperty("description").GetString() == "Rent" && x.GetProperty("status").GetString() == "confirmed");

        using var legacyRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/commitments?from=2026-07-01&through=2027-12-31");
        var legacy = await (await fixture.Client.SendAsync(legacyRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(legacy.GetProperty("plans").EnumerateArray(), x =>
            x.GetProperty("seriesId").GetGuid() == LegacyParityFixture.PlannedExpenseId &&
            x.GetProperty("versions")[0].GetProperty("changeReason").GetString() == "Migrated from legacy planned expense");

        async Task<Guid> CreateCommitment(
            string name, long amountCents, string kind, string cadence, string startDate, bool automaticPosting)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/commitments", token);
            request.Content = JsonContent.Create(new
            {
                categoryId, kind, name, amountCents, cadence, intervalCount = 1, startDate,
                budgetingMode = "due_period", automaticPosting,
            });
            var response = await fixture.Client.SendAsync(request);
            var value = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return value.GetProperty("seriesId").GetGuid();
        }
    }

    [Fact]
    public async Task Gradual_reservations_reduce_availability_and_prevent_double_charging()
    {
        const string token = LegacyParityFixture.ReservationAccessToken;
        using var defaultsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        var defaults = await (await fixture.Client.SendAsync(defaultsRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var categoryId = defaults.GetProperty("categories")[0].GetProperty("id").GetGuid();

        using var incomeRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", token);
        incomeRequest.Content = JsonContent.Create(new
        {
            kind = "income", occurredOn = "2026-07-23", description = "Income", amountCents = 300_000,
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(incomeRequest)).StatusCode);

        var defaultSeries = await CreateAnnual("Insurance", "2026-08-23", false);
        var catchUpSeries = await CreateAnnual("Tax", "2026-08-24", true);
        using var projectionRequest = Authenticated(
            HttpMethod.Get, "/api/v1/budget/commitments?from=2026-07-01&through=2027-09-01", token);
        var projection = await (await fixture.Client.SendAsync(projectionRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var first = Assert.Single(projection.GetProperty("occurrences").EnumerateArray(), occurrence =>
            occurrence.GetProperty("seriesId").GetGuid() == defaultSeries &&
            occurrence.GetProperty("scheduledOn").GetString() == "2026-08-23");
        Assert.Equal(10_000, first.GetProperty("reservationRateCents").GetInt64());
        Assert.Equal(10_000, first.GetProperty("reservationCoverageCents").GetInt64());
        Assert.Equal(110_000, first.GetProperty("reservationShortfallCents").GetInt64());
        var normalCycle = Assert.Single(projection.GetProperty("occurrences").EnumerateArray(), occurrence =>
            occurrence.GetProperty("seriesId").GetGuid() == defaultSeries &&
            occurrence.GetProperty("scheduledOn").GetString() == "2027-08-23");
        Assert.Equal(120_000, normalCycle.GetProperty("reservationCoverageCents").GetInt64());
        Assert.Equal(0, normalCycle.GetProperty("reservationShortfallCents").GetInt64());

        using var summaryRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        var summary = await (await fixture.Client.SendAsync(summaryRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(20_000, summary.GetProperty("reservationCents").GetInt64());
        Assert.Equal(280_000, summary.GetProperty("ordinaryAvailableCents").GetInt64());

        var defaultPosting = await Confirm(defaultSeries, "2026-08-23");
        Assert.Equal(10_000, defaultPosting.GetProperty("reservationCoverageCents").GetInt64());
        Assert.Equal(0, defaultPosting.GetProperty("directOrdinaryImpactCents").GetInt64());
        var defaultRetry = await Confirm(defaultSeries, "2026-08-23", HttpStatusCode.OK);
        Assert.Equal(defaultPosting.GetProperty("id").GetGuid(), defaultRetry.GetProperty("id").GetGuid());
        var catchUpPosting = await Confirm(catchUpSeries, "2026-08-24");
        Assert.Equal(10_000, catchUpPosting.GetProperty("reservationCoverageCents").GetInt64());
        Assert.Equal(-110_000, catchUpPosting.GetProperty("directOrdinaryImpactCents").GetInt64());

        using var timelineRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/timeline?origin=commitment_confirmation", token);
        var timeline = await (await fixture.Client.SendAsync(timelineRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var insurance = Assert.Single(timeline.EnumerateArray(), item => item.GetProperty("description").GetString() == "Insurance");
        Assert.Equal(120_000, insurance.GetProperty("amountCents").GetInt64());
        Assert.Equal(0, insurance.GetProperty("ordinaryImpactCents").GetInt64());

        async Task<Guid> CreateAnnual(string name, string startDate, bool chargeFirstShortfall)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/commitments", token);
            request.Content = JsonContent.Create(new
            {
                categoryId, kind = "fixed_cost", name, amountCents = 120_000, cadence = "yearly",
                intervalCount = 1, startDate, budgetingMode = "gradual_reservation",
                automaticPosting = false, chargeFirstShortfall,
            });
            var response = await fixture.Client.SendAsync(request);
            var plan = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return plan.GetProperty("seriesId").GetGuid();
        }

        async Task<JsonElement> Confirm(
            Guid seriesId,
            string scheduledOn,
            HttpStatusCode expectedStatus = HttpStatusCode.Created)
        {
            using var request = Authenticated(
                HttpMethod.Post, $"/api/v1/budget/commitments/{seriesId}/occurrences/{scheduledOn}/confirm", token);
            request.Content = JsonContent.Create(new { actualOn = scheduledOn, actualAmountCents = 120_000 });
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(expectedStatus, response.StatusCode);
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }
    }

    [Fact]
    public async Task Buffer_targets_are_funded_safely_and_period_close_carries_only_uncovered_deficit()
    {
        const string token = LegacyParityFixture.BufferAccessToken;
        using var setupRequest = Authenticated(HttpMethod.Put, "/api/v1/budget/setup", token);
        setupRequest.Content = JsonContent.Create(new
        {
            baseCurrency = "EUR", preferredPeriodStartDay = 1, bufferRule = "percentage",
            bufferAmountCents = 0, bufferPercentageBasisPoints = 2_500,
            defaultBufferDisposition = "retain",
            incomePlans = new[] { new { name = "Forecast salary", amountCents = 200_000 } },
        });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(setupRequest)).StatusCode);

        await PostLedger("income", "2026-07-23", "Actual salary", 100_000);
        var percentageSummary = await Summary("2026-07-23");
        Assert.Equal(50_000, percentageSummary.GetProperty("forecastBufferTargetCents").GetInt64());
        Assert.Equal(25_000, percentageSummary.GetProperty("actualBufferTargetCents").GetInt64());
        Assert.Equal(25_000, percentageSummary.GetProperty("fundedBufferCents").GetInt64());

        using var settingsRequest = Authenticated(HttpMethod.Patch, "/api/v1/budget/settings", token);
        settingsRequest.Content = JsonContent.Create(new
        {
            baseCurrency = "EUR", preferredPeriodStartDay = 1, bufferRule = "fixed",
            bufferAmountCents = 50_000, bufferPercentageBasisPoints = 0,
            defaultBufferDisposition = "retain",
        });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(settingsRequest)).StatusCode);
        await PostLedger("expense", "2026-07-24", "Overspend", 130_000);
        var overspent = await Summary("2026-07-23");
        Assert.Equal(50_000, overspent.GetProperty("fundedBufferCents").GetInt64());
        Assert.Equal(0, overspent.GetProperty("bufferShortfallCents").GetInt64());
        Assert.Equal(-80_000, overspent.GetProperty("ordinaryAvailableCents").GetInt64());
        Assert.Equal(50_000, overspent.GetProperty("protectedBufferCents").GetInt64());

        var periodId = overspent.GetProperty("period").GetProperty("id").GetGuid();
        using var closeRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/periods/{periodId}/close", token);
        closeRequest.Content = JsonContent.Create(new { coverDeficitCents = 30_000, disposition = "retain" });
        var closeResponse = await fixture.Client.SendAsync(closeRequest);
        var closed = await closeResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, closeResponse.StatusCode);
        Assert.Equal(80_000, closed.GetProperty("deficitCents").GetInt64());
        Assert.Equal(30_000, closed.GetProperty("coveredFromBufferCents").GetInt64());
        Assert.Equal(50_000, closed.GetProperty("carriedDeficitCents").GetInt64());
        Assert.Equal(20_000, closed.GetProperty("retainedBufferCents").GetInt64());
        using var closeRetry = Authenticated(HttpMethod.Post, $"/api/v1/budget/periods/{periodId}/close", token);
        closeRetry.Content = JsonContent.Create(new { coverDeficitCents = 30_000, disposition = "retain" });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(closeRetry)).StatusCode);

        await PostLedger("income", "2026-08-03", "Next salary", 100_000);
        var nextPeriod = await Summary("2026-08-03");
        Assert.Equal(50_000, nextPeriod.GetProperty("deficitCarryoverCents").GetInt64());
        Assert.Equal(20_000, nextPeriod.GetProperty("accumulatedBufferCents").GetInt64());
        Assert.Equal(0, nextPeriod.GetProperty("ordinaryAvailableCents").GetInt64());

        async Task PostLedger(string kind, string date, string description, long amountCents)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", token);
            request.Content = JsonContent.Create(new { kind, occurredOn = date, description, amountCents });
            Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(request)).StatusCode);
        }

        async Task<JsonElement> Summary(string date)
        {
            using var request = Authenticated(HttpMethod.Get, $"/api/v1/budget/summary?date={date}", token);
            return await (await fixture.Client.SendAsync(request)).Content.ReadFromJsonAsync<JsonElement>();
        }
    }

    [Fact]
    public async Task Savings_contributions_transfer_funded_value_and_allocate_exactly_once()
    {
        const string token = LegacyParityFixture.SavingsAccessToken;
        using var defaultsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        _ = await fixture.Client.SendAsync(defaultsRequest);
        await PostLedger("income", "2026-07-23", 100_000);
        var emergency = await CreatePurpose("Emergency");
        var holiday = await CreatePurpose("Holiday");

        using var contributionRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/savings/contributions", token);
        contributionRequest.Content = JsonContent.Create(new
        {
            idempotencyKey = "savings-july",
            occurredOn = "2026-07-23",
            description = "July savings",
            amountCents = 60_001,
            allocations = new[]
            {
                new { purposeId = emergency, mode = "fixed", value = 20_000 },
                new { purposeId = holiday, mode = "percentage", value = 3_333 },
            },
        });
        var contributionResponse = await fixture.Client.SendAsync(contributionRequest);
        var contribution = await contributionResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, contributionResponse.StatusCode);
        Assert.Equal(20_003, contribution.GetProperty("unallocatedCents").GetInt64());
        Assert.Equal(60_001, contribution.GetProperty("amountCents").GetInt64());

        using var retryRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/savings/contributions", token);
        retryRequest.Content = JsonContent.Create(new
        {
            idempotencyKey = "savings-july",
            occurredOn = "2026-07-23",
            description = "July savings",
            amountCents = 60_001,
            allocations = Array.Empty<object>(),
        });
        var retry = await fixture.Client.SendAsync(retryRequest);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);

        using var openingRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/savings/opening-values", token);
        openingRequest.Content = JsonContent.Create(new
        {
            occurredOn = "2026-07-01", description = "Existing savings", amountCents = 10_000,
            allocations = new[] { new { purposeId = emergency, mode = "fixed", value = 10_000 } },
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(openingRequest)).StatusCode);

        using var savingsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/savings", token);
        var savings = await (await fixture.Client.SendAsync(savingsRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(70_001, savings.GetProperty("totalSavedCents").GetInt64());
        Assert.Equal(20_003, savings.GetProperty("unallocatedCents").GetInt64());
        Assert.Equal(30_000, Assert.Single(savings.GetProperty("purposes").EnumerateArray(),
            item => item.GetProperty("id").GetGuid() == emergency).GetProperty("allocatedCents").GetInt64());
        Assert.Equal(19_998, Assert.Single(savings.GetProperty("purposes").EnumerateArray(),
            item => item.GetProperty("id").GetGuid() == holiday).GetProperty("allocatedCents").GetInt64());

        using var summaryRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        var summary = await (await fixture.Client.SendAsync(summaryRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(60_001, summary.GetProperty("savingsContributionCents").GetInt64());
        Assert.Equal(39_999, summary.GetProperty("ordinaryAvailableCents").GetInt64());
        Assert.Equal(70_001, summary.GetProperty("totalSavingsCents").GetInt64());
        using var timelineRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/timeline?kind=savings", token);
        var timeline = await (await fixture.Client.SendAsync(timelineRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(timeline.EnumerateArray(), item =>
            item.GetProperty("description").GetString() == "July savings" &&
            item.GetProperty("ordinaryImpactCents").GetInt64() == -60_001);
        Assert.Contains(timeline.EnumerateArray(), item =>
            item.GetProperty("description").GetString() == "Existing savings" &&
            item.GetProperty("ordinaryImpactCents").GetInt64() == 0);

        using var overfundedRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/savings/contributions", token);
        overfundedRequest.Content = JsonContent.Create(new
        {
            idempotencyKey = "too-much", occurredOn = "2026-07-24", description = "Too much",
            amountCents = 40_000, allocations = Array.Empty<object>(),
        });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await fixture.Client.SendAsync(overfundedRequest)).StatusCode);

        async Task<Guid> CreatePurpose(string name)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/savings/purposes", token);
            request.Content = JsonContent.Create(new { name });
            var response = await fixture.Client.SendAsync(request);
            var purpose = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return purpose.GetProperty("id").GetGuid();
        }

        async Task PostLedger(string kind, string date, long amountCents)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", token);
            request.Content = JsonContent.Create(new { kind, occurredOn = date, description = "Funding", amountCents });
            Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(request)).StatusCode);
        }
    }

    [Fact]
    public async Task Savings_goals_replan_pause_and_fund_purchases_without_double_charging_ordinary()
    {
        const string token = LegacyParityFixture.SavingsGoalsAccessToken;
        using (var defaults = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token))
            Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(defaults)).StatusCode);
        await Post("/api/v1/budget/ledger/entries", new
        {
            kind = "income", occurredOn = "2026-07-23", description = "Funding", amountCents = 200_000,
        }, HttpStatusCode.Created);

        var camera = await CreateGoal(new
        {
            name = "Camera", targetAmountCents = 60_000, planningMode = "date", targetDate = "2026-09-30",
        });
        var trip = await CreateGoal(new
        {
            name = "Trip", targetAmountCents = 40_000, planningMode = "rate", recurringContributionCents = 10_000,
        });
        var laptop = await CreateGoal(new
        {
            name = "Laptop", targetAmountCents = 20_000, planningMode = "rate", recurringContributionCents = 10_000,
        });

        await Post("/api/v1/budget/savings/contributions", new
        {
            idempotencyKey = "goal-funding",
            occurredOn = "2026-07-23",
            description = "Fund goals",
            amountCents = 85_000,
            allocations = new[]
            {
                new { purposeId = camera, mode = "fixed", value = 60_000 },
                new { purposeId = trip, mode = "fixed", value = 5_000 },
                new { purposeId = laptop, mode = "fixed", value = 20_000 },
            },
        }, HttpStatusCode.Created);

        var current = await GetSavings();
        var cameraBeforePurchase = Purpose(current, camera);
        var laptopBeforePurchase = Purpose(current, laptop);
        Assert.Equal("fully_funded", cameraBeforePurchase.GetProperty("status").GetString());
        Assert.True(cameraBeforePurchase.GetProperty("contributionsPaused").GetBoolean());
        Assert.Equal("fully_funded", laptopBeforePurchase.GetProperty("status").GetString());

        using (var futureRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/savings?asOf=2026-08-23", token))
        {
            var future = await (await fixture.Client.SendAsync(futureRequest)).Content.ReadFromJsonAsync<JsonElement>();
            var tripProjection = Purpose(future, trip);
            Assert.Equal("behind", tripProjection.GetProperty("status").GetString());
            Assert.Equal("2026-10-31", tripProjection.GetProperty("plannedFundingDate").GetString());
            Assert.Equal("2026-11-30", tripProjection.GetProperty("revisedFundingDate").GetString());
        }

        var purchaseBody = new
        {
            idempotencyKey = "camera-and-laptop-purchase",
            occurredOn = "2026-07-23",
            description = "Equipment",
            amountCents = 55_000,
            funding = new object[]
            {
                new { source = "goal", purposeId = camera, amountCents = 30_000 },
                new { source = "goal", purposeId = laptop, amountCents = 20_000 },
                new { source = "ordinary", purposeId = (Guid?)null, amountCents = 5_000 },
            },
        };
        await Post("/api/v1/budget/savings/purchases", purchaseBody, HttpStatusCode.Created);
        await Post("/api/v1/budget/savings/purchases", purchaseBody, HttpStatusCode.OK);

        var afterPurchase = await GetSavings();
        Assert.Equal(35_000, afterPurchase.GetProperty("totalSavedCents").GetInt64());
        Assert.Equal(30_000, Purpose(afterPurchase, camera).GetProperty("allocatedCents").GetInt64());
        Assert.NotEqual("completed", Purpose(afterPurchase, camera).GetProperty("status").GetString());
        Assert.Equal("completed", Purpose(afterPurchase, laptop).GetProperty("status").GetString());
        var purchase = Assert.Single(afterPurchase.GetProperty("purchases").EnumerateArray());
        Assert.Equal(55_000, purchase.GetProperty("amountCents").GetInt64());
        Assert.Equal(55_000, purchase.GetProperty("funding").EnumerateArray()
            .Sum(x => x.GetProperty("amountCents").GetInt64()));

        using (var summaryRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token))
        {
            var summary = await (await fixture.Client.SendAsync(summaryRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(110_000, summary.GetProperty("ordinaryAvailableCents").GetInt64());
        }
        using (var timelineRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/timeline", token))
        {
            var timeline = await (await fixture.Client.SendAsync(timelineRequest)).Content.ReadFromJsonAsync<JsonElement>();
            var purchaseEntry = Assert.Single(timeline.EnumerateArray(),
                x => x.GetProperty("origin").GetString() == "goal_purchase");
            Assert.Equal(55_000, purchaseEntry.GetProperty("amountCents").GetInt64());
            Assert.Equal(-5_000, purchaseEntry.GetProperty("ordinaryImpactCents").GetInt64());
        }

        await Post("/api/v1/budget/savings/purchases", new
        {
            idempotencyKey = "overdraw-goal", occurredOn = "2026-07-23",
            description = "Too expensive", amountCents = 30_001,
            funding = new[] { new { source = "goal", purposeId = camera, amountCents = 30_001 } },
        }, HttpStatusCode.UnprocessableEntity);

        async Task<Guid> CreateGoal(object body)
        {
            var response = await Post("/api/v1/budget/savings/goals", body, HttpStatusCode.Created);
            return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        async Task<HttpResponseMessage> Post(string path, object body, HttpStatusCode expected)
        {
            using var request = Authenticated(HttpMethod.Post, path, token);
            request.Content = JsonContent.Create(body);
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(expected, response.StatusCode);
            return response;
        }

        async Task<JsonElement> GetSavings()
        {
            using var request = Authenticated(HttpMethod.Get, "/api/v1/budget/savings", token);
            return await (await fixture.Client.SendAsync(request)).Content.ReadFromJsonAsync<JsonElement>();
        }

        static JsonElement Purpose(JsonElement projection, Guid id) =>
            Assert.Single(projection.GetProperty("purposes").EnumerateArray(),
                item => item.GetProperty("id").GetGuid() == id);
    }

    [Fact]
    public async Task Investments_keep_capital_valuations_and_routed_withdrawals_distinct()
    {
        const string token = LegacyParityFixture.InvestmentsAccessToken;
        await Post("/api/v1/budget/ledger/entries", new
        {
            kind = "income", occurredOn = "2026-07-23", description = "Salary", amountCents = 100_000,
        }, HttpStatusCode.Created);
        var goalResponse = await Post("/api/v1/budget/savings/goals", new
        {
            name = "Future home", targetAmountCents = 100_000,
            planningMode = "rate", recurringContributionCents = 10_000,
        }, HttpStatusCode.Created);
        var goalId = (await goalResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        await Post("/api/v1/budget/investments/opening-values", new
        {
            occurredOn = "2026-07-01", description = "Existing portfolio", amountCents = 20_000,
        }, HttpStatusCode.Created);
        var contribution = new
        {
            idempotencyKey = "investment-contribution", occurredOn = "2026-07-23",
            description = "ETF contribution", amountCents = 30_000,
        };
        await Post("/api/v1/budget/investments/contributions", contribution, HttpStatusCode.Created);
        await Post("/api/v1/budget/investments/contributions", contribution, HttpStatusCode.OK);
        await Post("/api/v1/budget/investments/valuations", new
        {
            occurredOn = "2026-07-23", description = "Broker statement", amountCents = 70_000,
        }, HttpStatusCode.Created);

        var valued = await GetInvestment();
        Assert.Equal(50_000, valued.GetProperty("contributedCapitalCents").GetInt64());
        Assert.Equal(70_000, valued.GetProperty("currentValueCents").GetInt64());
        Assert.Equal(20_000, valued.GetProperty("gainCents").GetInt64());
        Assert.Equal(4_000, valued.GetProperty("gainBasisPoints").GetInt64());
        using (var summaryRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token))
        {
            var summary = await (await fixture.Client.SendAsync(summaryRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(70_000, summary.GetProperty("ordinaryAvailableCents").GetInt64());
        }

        await Post("/api/v1/budget/investments/withdrawals", new
        {
            idempotencyKey = "withdraw-buffer", occurredOn = "2026-07-23",
            description = "Safe default", amountCents = 10_000,
        }, HttpStatusCode.Created);
        await Post("/api/v1/budget/investments/withdrawals", new
        {
            idempotencyKey = "withdraw-goal", occurredOn = "2026-07-23",
            description = "Route to home", amountCents = 5_000,
            destination = "savings", targetPurposeId = goalId,
        }, HttpStatusCode.Created);
        await Post("/api/v1/budget/investments/withdrawals", new
        {
            idempotencyKey = "withdraw-ordinary", occurredOn = "2026-07-23",
            description = "Release cash", amountCents = 5_000, destination = "ordinary",
        }, HttpStatusCode.Created);

        var after = await GetInvestment();
        Assert.Equal(50_000, after.GetProperty("currentValueCents").GetInt64());
        Assert.Equal(20_000, after.GetProperty("withdrawnCents").GetInt64());
        Assert.Equal(20_000, after.GetProperty("gainCents").GetInt64());
        Assert.Equal(4_000, after.GetProperty("gainBasisPoints").GetInt64());
        Assert.Equal(4, after.GetProperty("events").EnumerateArray()
            .Select(x => x.GetProperty("kind").GetString()).Distinct().Count());

        using (var savingsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/savings", token))
        {
            var savings = await (await fixture.Client.SendAsync(savingsRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(5_000, savings.GetProperty("totalSavedCents").GetInt64());
            Assert.Equal(5_000, Assert.Single(savings.GetProperty("purposes").EnumerateArray(),
                x => x.GetProperty("id").GetGuid() == goalId).GetProperty("allocatedCents").GetInt64());
        }
        using (var summaryRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token))
        {
            var summary = await (await fixture.Client.SendAsync(summaryRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(75_000, summary.GetProperty("ordinaryAvailableCents").GetInt64());
            Assert.Equal(10_000, summary.GetProperty("protectedBufferCents").GetInt64());
            Assert.Equal(50_000, summary.GetProperty("totalInvestmentCents").GetInt64());
        }
        using (var timelineRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/timeline?kind=investment", token))
        {
            var timeline = await (await fixture.Client.SendAsync(timelineRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains(timeline.EnumerateArray(), x =>
                x.GetProperty("origin").GetString() == "investment_valuation" &&
                x.GetProperty("ordinaryImpactCents").GetInt64() == 0);
            Assert.Contains(timeline.EnumerateArray(), x =>
                x.GetProperty("origin").GetString() == "investment_withdrawal" &&
                x.GetProperty("ordinaryImpactCents").GetInt64() == 5_000);
        }
        await Post("/api/v1/budget/investments/withdrawals", new
        {
            idempotencyKey = "withdraw-too-much", occurredOn = "2026-07-23",
            description = "Overdraw", amountCents = 50_001,
        }, HttpStatusCode.UnprocessableEntity);

        async Task<JsonElement> GetInvestment()
        {
            using var request = Authenticated(HttpMethod.Get, "/api/v1/budget/investments", token);
            return await (await fixture.Client.SendAsync(request)).Content.ReadFromJsonAsync<JsonElement>();
        }

        async Task<HttpResponseMessage> Post(string path, object body, HttpStatusCode expected)
        {
            using var request = Authenticated(HttpMethod.Post, path, token);
            request.Content = JsonContent.Create(body);
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(expected, response.StatusCode);
            return response;
        }
    }

    [Fact]
    public async Task Wishlist_items_remain_unfunded_until_atomically_linked_or_promoted()
    {
        const string token = LegacyParityFixture.WishlistAccessToken;
        var cameraResponse = await Post("/api/v1/budget/wishlist", new
        {
            name = "Cinema camera", estimatedPriceCents = 120_000,
            priority = "high", notes = "Financial reminder, not groceries",
        }, HttpStatusCode.Created);
        var camera = await cameraResponse.Content.ReadFromJsonAsync<JsonElement>();
        var cameraId = camera.GetProperty("id").GetGuid();
        Assert.Equal(JsonValueKind.Null, camera.GetProperty("savingsGoalId").ValueKind);

        var promotion = new
        {
            planningMode = "rate", recurringContributionCents = 10_000,
        };
        var promotedResponse = await Post(
            $"/api/v1/budget/wishlist/{cameraId}/promote", promotion, HttpStatusCode.OK);
        var promoted = await promotedResponse.Content.ReadFromJsonAsync<JsonElement>();
        var goalId = promoted.GetProperty("savingsGoalId").GetGuid();
        var retryResponse = await Post(
            $"/api/v1/budget/wishlist/{cameraId}/promote",
            new { planningMode = "date", targetDate = "2027-12-31" }, HttpStatusCode.OK);
        Assert.Equal(goalId, (await retryResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("savingsGoalId").GetGuid());

        using (var savingsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/savings", token))
        {
            var savings = await (await fixture.Client.SendAsync(savingsRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(0, savings.GetProperty("totalSavedCents").GetInt64());
            var goal = Assert.Single(savings.GetProperty("purposes").EnumerateArray());
            Assert.Equal(goalId, goal.GetProperty("id").GetGuid());
            Assert.Equal(120_000, goal.GetProperty("targetAmountCents").GetInt64());
            Assert.Equal(0, goal.GetProperty("allocatedCents").GetInt64());
        }

        var bicycleResponse = await Post("/api/v1/budget/wishlist", new
        {
            name = "Cargo bicycle", estimatedPriceCents = 300_000, priority = "medium",
        }, HttpStatusCode.Created);
        var bicycleId = (await bicycleResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var linkedResponse = await Post($"/api/v1/budget/wishlist/{bicycleId}/promote",
            new { savingsGoalId = goalId }, HttpStatusCode.OK);
        Assert.Equal(goalId, (await linkedResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("savingsGoalId").GetGuid());

        using (var update = Authenticated(HttpMethod.Patch, $"/api/v1/budget/wishlist/{cameraId}", token))
        {
            update.Content = JsonContent.Create(new { status = "completed", notes = "Bought elsewhere" });
            Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(update)).StatusCode);
        }
        using (var listRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/wishlist", token))
        {
            var items = await (await fixture.Client.SendAsync(listRequest)).Content.ReadFromJsonAsync<JsonElement>();
            var completed = Assert.Single(items.EnumerateArray(),
                x => x.GetProperty("id").GetGuid() == cameraId);
            Assert.Equal("completed", completed.GetProperty("status").GetString());
            Assert.Equal(goalId, completed.GetProperty("savingsGoalId").GetGuid());
        }
        using (var savingsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/savings", token))
        {
            var savings = await (await fixture.Client.SendAsync(savingsRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Single(savings.GetProperty("purposes").EnumerateArray());
        }

        async Task<HttpResponseMessage> Post(string path, object body, HttpStatusCode expected)
        {
            using var request = Authenticated(HttpMethod.Post, path, token);
            request.Content = JsonContent.Create(body);
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(expected, response.StatusCode);
            return response;
        }
    }

    [Fact]
    public async Task Reminder_settings_are_saved_per_plan_and_reject_foreign_series()
    {
        const string token = LegacyParityFixture.ReminderSettingsAccessToken;
        using var defaultsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        var defaults = await (await fixture.Client.SendAsync(defaultsRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var categoryId = defaults.GetProperty("categories")[0].GetProperty("id").GetGuid();
        var incomeSeries = await CreateIncomePlan("Reminder salary", "2026-07-23");
        var commitmentSeries = await CreateCommitment("Reminder rent", "2026-07-31");

        var incomeSetting = await (await Put($"/api/v1/budget/reminders/settings/income/{incomeSeries}",
            new { dueEnabled = true, overdueEnabled = true }, HttpStatusCode.OK)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("income", incomeSetting.GetProperty("planKind").GetString());
        Assert.Equal(incomeSeries, incomeSetting.GetProperty("seriesId").GetGuid());
        Assert.True(incomeSetting.GetProperty("dueEnabled").GetBoolean());
        Assert.True(incomeSetting.GetProperty("overdueEnabled").GetBoolean());
        _ = await Put($"/api/v1/budget/reminders/settings/commitment/{commitmentSeries}",
            new { dueEnabled = true, overdueEnabled = true }, HttpStatusCode.OK);

        using (var listRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/reminders/settings", token))
        {
            var settings = await (await fixture.Client.SendAsync(listRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(2, settings.GetArrayLength());
            Assert.Equal("commitment", settings[0].GetProperty("planKind").GetString());
            Assert.Equal(commitmentSeries, settings[0].GetProperty("seriesId").GetGuid());
            Assert.Equal("income", settings[1].GetProperty("planKind").GetString());
            Assert.Equal(incomeSeries, settings[1].GetProperty("seriesId").GetGuid());
        }

        _ = await Put($"/api/v1/budget/reminders/settings/income/{incomeSeries}",
            new { dueEnabled = false, overdueEnabled = false }, HttpStatusCode.OK);
        using (var listRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/reminders/settings", token))
        {
            var settings = await (await fixture.Client.SendAsync(listRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(2, settings.GetArrayLength());
            var income = Assert.Single(settings.EnumerateArray(),
                x => x.GetProperty("planKind").GetString() == "income");
            Assert.False(income.GetProperty("dueEnabled").GetBoolean());
            Assert.False(income.GetProperty("overdueEnabled").GetBoolean());
        }

        var unknownResponse = await Put($"/api/v1/budget/reminders/settings/income/{Guid.NewGuid()}",
            new { dueEnabled = true, overdueEnabled = true }, HttpStatusCode.NotFound);
        var unknown = await unknownResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Recurring plan was not found", unknown.GetProperty("detail").GetString());
        _ = await Put($"/api/v1/budget/reminders/settings/expense/{incomeSeries}",
            new { dueEnabled = true, overdueEnabled = true }, HttpStatusCode.NotFound);

        using (var intruderPut = Authenticated(HttpMethod.Put,
                   $"/api/v1/budget/reminders/settings/income/{incomeSeries}",
                   LegacyParityFixture.ReminderIntruderAccessToken))
        {
            intruderPut.Content = JsonContent.Create(new { dueEnabled = true, overdueEnabled = true });
            Assert.Equal(HttpStatusCode.NotFound, (await fixture.Client.SendAsync(intruderPut)).StatusCode);
        }
        using (var intruderList = Authenticated(HttpMethod.Get, "/api/v1/budget/reminders/settings",
                   LegacyParityFixture.ReminderIntruderAccessToken))
        {
            var settings = await (await fixture.Client.SendAsync(intruderList)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(0, settings.GetArrayLength());
        }

        using (var anonymousPut = new HttpRequestMessage(
                   HttpMethod.Put, $"/api/v1/budget/reminders/settings/income/{incomeSeries}"))
        {
            anonymousPut.Content = JsonContent.Create(new { dueEnabled = true, overdueEnabled = true });
            Assert.Equal(HttpStatusCode.Unauthorized, (await fixture.Client.SendAsync(anonymousPut)).StatusCode);
        }
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await fixture.Client.GetAsync("/api/v1/budget/reminders/settings")).StatusCode);

        async Task<HttpResponseMessage> Put(string path, object body, HttpStatusCode expected)
        {
            using var request = Authenticated(HttpMethod.Put, path, token);
            request.Content = JsonContent.Create(body);
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(expected, response.StatusCode);
            return response;
        }

        async Task<Guid> CreateIncomePlan(string name, string startDate)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/income-plans", token);
            request.Content = JsonContent.Create(new
            {
                name, amountCents = 100_000, cadence = "monthly", intervalCount = 1, startDate,
                automaticPosting = false,
            });
            var response = await fixture.Client.SendAsync(request);
            var plan = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return plan.GetProperty("seriesId").GetGuid();
        }

        async Task<Guid> CreateCommitment(string name, string startDate)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/commitments", token);
            request.Content = JsonContent.Create(new
            {
                categoryId, kind = "fixed_cost", name, amountCents = 80_000, cadence = "monthly",
                intervalCount = 1, startDate, budgetingMode = "due_period", automaticPosting = false,
            });
            var response = await fixture.Client.SendAsync(request);
            var plan = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return plan.GetProperty("seriesId").GetGuid();
        }
    }

    [Fact]
    public async Task Reminders_surface_due_and_overdue_only_for_enabled_manual_plans()
    {
        const string token = LegacyParityFixture.ReminderAccessToken;
        using var defaultsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        var defaults = await (await fixture.Client.SendAsync(defaultsRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var categoryId = defaults.GetProperty("categories")[0].GetProperty("id").GetGuid();

        var dueToday = await CreateIncomePlan("Salary due today", 100_000, false, "2026-07-23");
        var overdueDisabled = await CreateIncomePlan("Missed payout", 50_000, false, "2026-07-18");
        var future = await CreateIncomePlan("Future bonus", 25_000, false, "2026-08-01");
        var automatic = await CreateIncomePlan("Automated stipend", 10_000, true, "2026-07-23");
        _ = await CreateIncomePlan("Unwatched payout", 5_000, false, "2026-07-21");
        var overdueCommitment = await CreateCommitment("Overdue rent", 80_000, "2026-07-20");

        await SaveSetting("income", dueToday, true, false);
        await SaveSetting("income", overdueDisabled, true, false);
        await SaveSetting("income", future, true, true);
        await SaveSetting("income", automatic, true, true);
        await SaveSetting("commitment", overdueCommitment, true, true);

        var reminders = await ListReminders(null);
        Assert.Equal(2, reminders.GetArrayLength());
        Assert.Equal($"commitment:commitment:{overdueCommitment}:2026-07-20:overdue",
            reminders[0].GetProperty("id").GetString());
        Assert.Equal("overdue", reminders[0].GetProperty("kind").GetString());
        Assert.Equal("2026-07-20", reminders[0].GetProperty("dueOn").GetString());
        Assert.Equal("Overdue rent", reminders[0].GetProperty("name").GetString());
        Assert.Equal(80_000, reminders[0].GetProperty("amountCents").GetInt64());
        Assert.Equal($"income:income:{dueToday}:2026-07-23:due", reminders[1].GetProperty("id").GetString());
        Assert.Equal("due", reminders[1].GetProperty("kind").GetString());
        Assert.Equal("2026-07-23", reminders[1].GetProperty("dueOn").GetString());
        Assert.Equal($"income:{dueToday}:2026-07-23", reminders[1].GetProperty("occurrenceId").GetString());
        Assert.Equal("Salary due today", reminders[1].GetProperty("name").GetString());

        var reclassified = await ListReminders("2026-07-20");
        var commitmentDue = Assert.Single(reclassified.EnumerateArray());
        Assert.Equal("due", commitmentDue.GetProperty("kind").GetString());
        Assert.Equal(overdueCommitment, commitmentDue.GetProperty("seriesId").GetGuid());

        foreach (var invalid in new[] { "20.07.2026", "2026-7-2" })
        {
            using var invalidRequest = Authenticated(HttpMethod.Get, $"/api/v1/budget/reminders?asOf={invalid}", token);
            var invalidResponse = await fixture.Client.SendAsync(invalidRequest);
            Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
            var problem = await invalidResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("asOf must use YYYY-MM-DD", problem.GetProperty("detail").GetString());
        }
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await fixture.Client.GetAsync("/api/v1/budget/reminders")).StatusCode);
        using (var intruderRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/reminders",
                   LegacyParityFixture.ReminderIntruderAccessToken))
        {
            var intruderReminders = await (await fixture.Client.SendAsync(intruderRequest))
                .Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(0, intruderReminders.GetArrayLength());
        }

        using (var confirm = Authenticated(HttpMethod.Post,
                   $"/api/v1/budget/income-plans/{dueToday}/occurrences/2026-07-23/confirm", token))
        {
            confirm.Content = JsonContent.Create(new { actualOn = "2026-07-23", actualAmountCents = 100_000 });
            Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(confirm)).StatusCode);
        }
        var remaining = await ListReminders(null);
        var lastReminder = Assert.Single(remaining.EnumerateArray());
        Assert.Equal("overdue", lastReminder.GetProperty("kind").GetString());
        Assert.Equal(overdueCommitment, lastReminder.GetProperty("seriesId").GetGuid());

        async Task<Guid> CreateIncomePlan(string name, long amountCents, bool automaticPosting, string startDate)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/income-plans", token);
            request.Content = JsonContent.Create(new
            {
                name, amountCents, cadence = "monthly", intervalCount = 1, startDate, automaticPosting,
            });
            var response = await fixture.Client.SendAsync(request);
            var plan = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return plan.GetProperty("seriesId").GetGuid();
        }

        async Task<Guid> CreateCommitment(string name, long amountCents, string startDate)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/commitments", token);
            request.Content = JsonContent.Create(new
            {
                categoryId, kind = "fixed_cost", name, amountCents, cadence = "monthly",
                intervalCount = 1, startDate, budgetingMode = "due_period", automaticPosting = false,
            });
            var response = await fixture.Client.SendAsync(request);
            var plan = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return plan.GetProperty("seriesId").GetGuid();
        }

        async Task SaveSetting(string planKind, Guid seriesId, bool dueEnabled, bool overdueEnabled)
        {
            using var request = Authenticated(
                HttpMethod.Put, $"/api/v1/budget/reminders/settings/{planKind}/{seriesId}", token);
            request.Content = JsonContent.Create(new { dueEnabled, overdueEnabled });
            Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(request)).StatusCode);
        }

        async Task<JsonElement> ListReminders(string? asOf)
        {
            var path = asOf is null ? "/api/v1/budget/reminders" : $"/api/v1/budget/reminders?asOf={asOf}";
            using var request = Authenticated(HttpMethod.Get, path, token);
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }
    }

    [Fact]
    public async Task Automation_runs_are_deterministic_and_idempotent_with_stable_ledger_counts()
    {
        const string token = LegacyParityFixture.AutomationAccessToken;
        using var defaultsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/summary", token);
        var defaults = await (await fixture.Client.SendAsync(defaultsRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var categoryId = defaults.GetProperty("categories")[0].GetProperty("id").GetGuid();

        using var incomePlanRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/income-plans", token);
        incomePlanRequest.Content = JsonContent.Create(new
        {
            name = "Automated payout", amountCents = 1_000, cadence = "daily", intervalCount = 1,
            startDate = "2026-07-19", automaticPosting = true,
        });
        var incomePlanResponse = await fixture.Client.SendAsync(incomePlanRequest);
        Assert.Equal(HttpStatusCode.Created, incomePlanResponse.StatusCode);
        var incomeSeries = (await incomePlanResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("seriesId").GetGuid();
        using var commitmentRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/commitments", token);
        commitmentRequest.Content = JsonContent.Create(new
        {
            categoryId, kind = "fixed_cost", name = "Automated utility", amountCents = 2_000,
            cadence = "monthly", intervalCount = 1, startDate = "2026-07-23",
            budgetingMode = "due_period", automaticPosting = true,
        });
        var commitmentResponse = await fixture.Client.SendAsync(commitmentRequest);
        Assert.Equal(HttpStatusCode.Created, commitmentResponse.StatusCode);
        var commitmentSeries = (await commitmentResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("seriesId").GetGuid();

        const string incomeAutoPostPath = "/api/v1/budget/income-plans/auto-post?from=2026-07-19&through=2026-07-21";
        var firstRun = await AutoPost(incomeAutoPostPath);
        Assert.Equal(3, firstRun.GetProperty("posted").GetInt32());
        Assert.Equal(0, firstRun.GetProperty("alreadyPosted").GetInt32());
        var retryRun = await AutoPost(incomeAutoPostPath);
        Assert.Equal(0, retryRun.GetProperty("posted").GetInt32());
        Assert.Equal(3, retryRun.GetProperty("alreadyPosted").GetInt32());
        Assert.Equal(3, await CountLedgerEntries("income_automatic"));

        const string commitmentAutoPostPath = "/api/v1/budget/commitments/auto-post?from=2026-07-23&through=2026-07-23";
        var commitmentRun = await AutoPost(commitmentAutoPostPath);
        Assert.Equal(1, commitmentRun.GetProperty("posted").GetInt32());
        Assert.Equal(0, commitmentRun.GetProperty("alreadyPosted").GetInt32());
        var commitmentRetry = await AutoPost(commitmentAutoPostPath);
        Assert.Equal(0, commitmentRetry.GetProperty("posted").GetInt32());
        Assert.Equal(1, commitmentRetry.GetProperty("alreadyPosted").GetInt32());
        Assert.Equal(1, await CountLedgerEntries("commitment_automatic"));
        using (var timelineRequest = Authenticated(
                   HttpMethod.Get, "/api/v1/budget/timeline?origin=commitment_automatic", token))
        {
            var timeline = await (await fixture.Client.SendAsync(timelineRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(1, timeline.EnumerateArray().Count(x => x.GetProperty("entryType").GetString() == "actual"));
        }

        var firstProjection = await ProjectOccurrences();
        var secondProjection = await ProjectOccurrences();
        Assert.Equal(
        [
            $"income:{incomeSeries}:2026-07-19", $"income:{incomeSeries}:2026-07-20",
            $"income:{incomeSeries}:2026-07-21", $"income:{incomeSeries}:2026-07-22",
            $"income:{incomeSeries}:2026-07-23",
        ], firstProjection.Select(x => x.Id));
        Assert.Equal(firstProjection, secondProjection);

        const string concurrentPath = "/api/v1/budget/income-plans/auto-post?from=2026-07-22&through=2026-07-23";
        using var concurrentA = Authenticated(HttpMethod.Post, concurrentPath, token);
        using var concurrentB = Authenticated(HttpMethod.Post, concurrentPath, token);
        var client = fixture.Client;
        var concurrentResponses = await Task.WhenAll(client.SendAsync(concurrentA), client.SendAsync(concurrentB));
        var counters = new List<(int Posted, int AlreadyPosted)>();
        foreach (var response in concurrentResponses)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            counters.Add((body.GetProperty("posted").GetInt32(), body.GetProperty("alreadyPosted").GetInt32()));
        }
        Assert.All(counters, x => Assert.Equal(2, x.Posted + x.AlreadyPosted));
        Assert.Equal(2, counters.Sum(x => x.Posted));
        Assert.Equal(5, await CountLedgerEntries("income_automatic"));

        await EnableReminders("income", incomeSeries);
        await EnableReminders("commitment", commitmentSeries);
        using (var remindersRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/reminders", token))
        {
            var reminders = await (await fixture.Client.SendAsync(remindersRequest)).Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(0, reminders.GetArrayLength());
        }

        async Task<JsonElement> AutoPost(string path)
        {
            using var request = Authenticated(HttpMethod.Post, path, token);
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }

        async Task<int> CountLedgerEntries(string source)
        {
            using var request = Authenticated(HttpMethod.Get, "/api/v1/budget/ledger/entries", token);
            var entries = await (await fixture.Client.SendAsync(request)).Content.ReadFromJsonAsync<JsonElement>();
            return entries.EnumerateArray().Count(x => x.GetProperty("source").GetString() == source);
        }

        async Task<List<(string Id, string Status)>> ProjectOccurrences()
        {
            using var request = Authenticated(
                HttpMethod.Get, "/api/v1/budget/income-plans?from=2026-07-19&through=2026-07-23", token);
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var projection = await response.Content.ReadFromJsonAsync<JsonElement>();
            return projection.GetProperty("occurrences").EnumerateArray()
                .Select(x => (x.GetProperty("id").GetString()!, x.GetProperty("status").GetString()!)).ToList();
        }

        async Task EnableReminders(string planKind, Guid seriesId)
        {
            using var request = Authenticated(
                HttpMethod.Put, $"/api/v1/budget/reminders/settings/{planKind}/{seriesId}", token);
            request.Content = JsonContent.Create(new { dueEnabled = true, overdueEnabled = true });
            Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(request)).StatusCode);
        }
    }

    [Fact]
    public async Task Reports_aggregate_effective_corrected_state_with_exact_shares_and_filters()
    {
        const string token = LegacyParityFixture.ReportsAccessToken;
        var foodId = await CreateCategory("Food", "#16a34a", "basket");
        var funId = await CreateCategory("Fun", "#7c3aed", "sparkles");

        using var incomeRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", token);
        incomeRequest.Content = JsonContent.Create(new
        {
            kind = "income", occurredOn = "2026-07-15", description = "Salary", amountCents = 100_000,
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(incomeRequest)).StatusCode);

        using var splitRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", token);
        splitRequest.Content = JsonContent.Create(new
        {
            kind = "expense", occurredOn = "2026-07-20", description = "Shared Disney purchase",
            merchant = "  Disney+ ", amountCents = 10_001, affectsOrdinary = true,
            splits = new object[]
            {
                new { categoryId = foodId, amountCents = 3_333, useRemaining = false, affectsOrdinary = true },
                new { categoryId = funId, amountCents = (long?)null, useRemaining = true, affectsOrdinary = true },
            },
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(splitRequest)).StatusCode);

        var groceriesId = await PostExpense("Groceries run", 10_000, foodId, "REWE", "2026-07-18");
        using var correctionRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/ledger/entries/{groceriesId}/corrections", token);
        correctionRequest.Content = JsonContent.Create(new
        {
            reason = "Receipt showed a different total", description = "Groceries run corrected",
            occurredOn = "2026-07-18", amountCents = 12_000, categoryId = foodId,
            affectsOrdinary = true, merchant = "REWE",
        });
        var correctionResponse = await fixture.Client.SendAsync(correctionRequest);
        Assert.Equal(HttpStatusCode.Created, correctionResponse.StatusCode);
        var correctionId = (await correctionResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var duplicateId = await PostExpense("Duplicate expense", 5_000, foodId, "REWE", "2026-07-19");
        using var voidRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/ledger/entries/{duplicateId}/voids", token);
        voidRequest.Content = JsonContent.Create(new { reason = "Duplicate import" });
        Assert.Equal(HttpStatusCode.NoContent, (await fixture.Client.SendAsync(voidRequest)).StatusCode);

        using var refundRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/ledger/entries/{correctionId}/refunds", token);
        refundRequest.Content = JsonContent.Create(new { occurredOn = "2026-07-21", amountCents = 2_000, description = "Partial refund" });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(refundRequest)).StatusCode);

        var categorySpend = await GetReport("/api/v1/budget/reports/category-spend");
        var food = CategoryRow(categorySpend, foodId);
        var fun = CategoryRow(categorySpend, funId);
        Assert.Equal(15_333, food.GetProperty("grossExpenseCents").GetInt64());
        Assert.Equal(2_000, food.GetProperty("refundCents").GetInt64());
        Assert.Equal(13_333, food.GetProperty("netSpentCents").GetInt64());
        Assert.Equal(6_668, fun.GetProperty("netSpentCents").GetInt64());
        Assert.Equal(20_001, categorySpend.GetProperty("totalNetSpentCents").GetInt64());
        Assert.Equal(6_666, food.GetProperty("shareBasisPoints").GetInt64());
        Assert.Equal(3_334, fun.GetProperty("shareBasisPoints").GetInt64());
        Assert.Equal(10_000, categorySpend.GetProperty("rows").EnumerateArray()
            .Sum(x => x.GetProperty("shareBasisPoints").GetInt64()));
        Assert.Equal("Food", food.GetProperty("name").GetString());
        Assert.Equal("#16a34a", food.GetProperty("color").GetString());

        var merchantSpend = await GetReport("/api/v1/budget/reports/merchant-spend");
        var disney = merchantSpend.GetProperty("rows").EnumerateArray()
            .Single(x => x.GetProperty("brandKey").GetString() == "disney-plus");
        var rewe = merchantSpend.GetProperty("rows").EnumerateArray()
            .Single(x => x.GetProperty("merchant").GetString() == "REWE");
        Assert.Equal(10_001, disney.GetProperty("netSpentCents").GetInt64());
        Assert.Equal(12_000, rewe.GetProperty("grossExpenseCents").GetInt64());
        Assert.Equal(2_000, rewe.GetProperty("refundCents").GetInt64());
        Assert.Equal(10_000, rewe.GetProperty("netSpentCents").GetInt64());

        var filteredByCategory = await GetReport($"/api/v1/budget/reports/category-spend?categoryId={foodId}");
        Assert.Equal(13_333, filteredByCategory.GetProperty("totalNetSpentCents").GetInt64());
        Assert.Equal(10_000, CategoryRow(filteredByCategory, foodId).GetProperty("shareBasisPoints").GetInt64());

        var filteredByMerchant = await GetReport("/api/v1/budget/reports/category-spend?merchant=REWE");
        Assert.Equal(10_000, filteredByMerchant.GetProperty("totalNetSpentCents").GetInt64());

        var refundDay = await GetReport("/api/v1/budget/reports/category-spend?from=2026-07-21&through=2026-07-21");
        Assert.Equal(-2_000, refundDay.GetProperty("totalNetSpentCents").GetInt64());
        Assert.Equal(0, CategoryRow(refundDay, foodId).GetProperty("shareBasisPoints").GetInt64());

        var comparison = await GetReport("/api/v1/budget/reports/period-comparison");
        var july = comparison.GetProperty("rows").EnumerateArray()
            .Single(x => x.GetProperty("startDate").GetString() == "2026-07-01");
        Assert.Equal(100_000, july.GetProperty("incomeCents").GetInt64());
        Assert.Equal(20_001, july.GetProperty("netSpendCents").GetInt64());
        Assert.False(july.GetProperty("closed").GetBoolean());

        var incomeReport = await GetReport("/api/v1/budget/reports/income");
        Assert.Equal(0, incomeReport.GetProperty("expectedCents").GetInt64());
        Assert.Equal(100_000, incomeReport.GetProperty("actualCents").GetInt64());
        Assert.Equal(JsonValueKind.Null, incomeReport.GetProperty("varianceBasisPoints").ValueKind);

        var buffer = await GetReport("/api/v1/budget/reports/buffer");
        var openRow = buffer.GetProperty("rows").EnumerateArray().Single(x => x.GetProperty("open").GetBoolean());
        Assert.Equal("2026-07-01", openRow.GetProperty("startDate").GetString());

        using var renameRequest = Authenticated(HttpMethod.Patch, $"/api/v1/budget/categories/{foodId}", token);
        renameRequest.Content = JsonContent.Create(new
        {
            name = "Groceries", color = "#15803d", icon = "shopping-cart", behavior = "include_in_limit", archived = false,
        });
        Assert.Equal(HttpStatusCode.OK, (await fixture.Client.SendAsync(renameRequest)).StatusCode);
        var afterRename = await GetReport("/api/v1/budget/reports/category-spend");
        var historicalFood = CategoryRow(afterRename, foodId);
        Assert.Equal("Food", historicalFood.GetProperty("name").GetString());
        Assert.Equal("#16a34a", historicalFood.GetProperty("color").GetString());
        Assert.Equal(13_333, historicalFood.GetProperty("netSpentCents").GetInt64());

        using var badDateRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/reports/category-spend?from=21.07.2026", token);
        Assert.Equal(HttpStatusCode.BadRequest, (await fixture.Client.SendAsync(badDateRequest)).StatusCode);
        using var invertedRequest = Authenticated(
            HttpMethod.Get, "/api/v1/budget/reports/category-spend?from=2026-07-21&through=2026-07-01", token);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await fixture.Client.SendAsync(invertedRequest)).StatusCode);
        using var foreignCategoryRequest = Authenticated(
            HttpMethod.Get, $"/api/v1/budget/reports/category-spend?categoryId={foodId}",
            LegacyParityFixture.ReportsIntruderAccessToken);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.Client.SendAsync(foreignCategoryRequest)).StatusCode);
        using var intruderRequest = Authenticated(
            HttpMethod.Get, "/api/v1/budget/reports/category-spend", LegacyParityFixture.ReportsIntruderAccessToken);
        var intruderReport = await (await fixture.Client.SendAsync(intruderRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, intruderReport.GetProperty("rows").GetArrayLength());
        Assert.Equal(0, intruderReport.GetProperty("totalNetSpentCents").GetInt64());
        using var anonymousRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/budget/reports/category-spend");
        Assert.Equal(HttpStatusCode.Unauthorized, (await fixture.Client.SendAsync(anonymousRequest)).StatusCode);

        async Task<Guid> CreateCategory(string name, string color, string icon)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/categories", token);
            request.Content = JsonContent.Create(new { name, color, icon, behavior = "include_in_limit" });
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        async Task<Guid> PostExpense(string description, long amountCents, Guid categoryId, string merchant, string occurredOn)
        {
            using var request = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", token);
            request.Content = JsonContent.Create(new
            {
                kind = "expense", occurredOn, description, amountCents, categoryId, merchant, affectsOrdinary = true,
            });
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        }

        async Task<JsonElement> GetReport(string path)
        {
            using var request = Authenticated(HttpMethod.Get, path, token);
            var response = await fixture.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }

        static JsonElement CategoryRow(JsonElement report, Guid categoryId) =>
            report.GetProperty("rows").EnumerateArray().Single(x =>
                x.GetProperty("categoryId").ValueKind != JsonValueKind.Null &&
                x.GetProperty("categoryId").GetGuid() == categoryId);
    }

    [Fact]
    public async Task Planned_vs_actual_savings_and_investment_reports_match_postings()
    {
        const string token = LegacyParityFixture.ReportsPlanAccessToken;

        using var planRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/income-plans", token);
        planRequest.Content = JsonContent.Create(new
        {
            name = "Report salary", amountCents = 100_000, cadence = "monthly",
            automaticPosting = false, startDate = "2026-07-02",
        });
        var planResponse = await fixture.Client.SendAsync(planRequest);
        Assert.Equal(HttpStatusCode.Created, planResponse.StatusCode);
        var planSeriesId = (await planResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("seriesId").GetGuid();
        using var confirmIncomeRequest = Authenticated(
            HttpMethod.Post, $"/api/v1/budget/income-plans/{planSeriesId}/occurrences/2026-07-02/confirm", token);
        confirmIncomeRequest.Content = JsonContent.Create(new { actualOn = "2026-07-02", actualAmountCents = 90_000 });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(confirmIncomeRequest)).StatusCode);

        using var commitmentRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/commitments", token);
        commitmentRequest.Content = JsonContent.Create(new
        {
            name = "Report insurance", kind = "fixed_cost", cadence = "monthly", amountCents = 8_000,
            startDate = "2026-07-10", budgetingMode = "due_period", chargeFirstShortfall = false, automaticPosting = false,
        });
        var commitmentResponse = await fixture.Client.SendAsync(commitmentRequest);
        Assert.Equal(HttpStatusCode.Created, commitmentResponse.StatusCode);
        var commitmentSeriesId = (await commitmentResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("seriesId").GetGuid();
        using var confirmCommitmentRequest = Authenticated(
            HttpMethod.Post, $"/api/v1/budget/commitments/{commitmentSeriesId}/occurrences/2026-07-10/confirm", token);
        confirmCommitmentRequest.Content = JsonContent.Create(new { actualOn = "2026-07-10", actualAmountCents = 8_450 });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(confirmCommitmentRequest)).StatusCode);

        using var reportRequest = Authenticated(
            HttpMethod.Get, "/api/v1/budget/reports/planned-vs-actual?from=2026-07-01&through=2026-07-23", token);
        var report = await (await fixture.Client.SendAsync(reportRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var incomeRow = report.GetProperty("income").EnumerateArray()
            .Single(x => x.GetProperty("seriesId").GetGuid() == planSeriesId);
        Assert.Equal(100_000, incomeRow.GetProperty("plannedCents").GetInt64());
        Assert.Equal(90_000, incomeRow.GetProperty("actualCents").GetInt64());
        Assert.Equal(-10_000, incomeRow.GetProperty("varianceCents").GetInt64());
        Assert.Equal(-1_000, incomeRow.GetProperty("varianceBasisPoints").GetInt64());
        Assert.Equal(1, incomeRow.GetProperty("postedCount").GetInt32());
        var commitmentRow = report.GetProperty("commitments").EnumerateArray()
            .Single(x => x.GetProperty("seriesId").GetGuid() == commitmentSeriesId);
        Assert.Equal(8_000, commitmentRow.GetProperty("plannedCents").GetInt64());
        Assert.Equal(8_450, commitmentRow.GetProperty("actualCents").GetInt64());
        Assert.Equal(562, commitmentRow.GetProperty("varianceBasisPoints").GetInt64());

        using var filteredRequest = Authenticated(
            HttpMethod.Get, "/api/v1/budget/reports/planned-vs-actual?from=2026-07-01&through=2026-07-23&categoryId="
            + Guid.NewGuid(), token);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.Client.SendAsync(filteredRequest)).StatusCode);

        using var goalRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/savings/goals", token);
        goalRequest.Content = JsonContent.Create(new
        {
            name = "Report goal", targetAmountCents = 50_000, planningMode = "rate", recurringContributionCents = 10_000,
        });
        var goalResponse = await fixture.Client.SendAsync(goalRequest);
        Assert.Equal(HttpStatusCode.Created, goalResponse.StatusCode);
        var goalId = (await goalResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        using var contributionRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/savings/contributions", token);
        contributionRequest.Content = JsonContent.Create(new
        {
            idempotencyKey = "report-saving-1", occurredOn = "2026-07-12", description = "Report saving",
            amountCents = 10_000,
            allocations = new object[] { new { purposeId = goalId, mode = "fixed", value = 10_000 } },
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(contributionRequest)).StatusCode);

        using var goalsReportRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/reports/savings-goals", token);
        var goalsReport = await (await fixture.Client.SendAsync(goalsReportRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var goalRow = goalsReport.GetProperty("rows").EnumerateArray()
            .Single(x => x.GetProperty("purposeId").GetGuid() == goalId);
        Assert.Equal(10_000, goalRow.GetProperty("allocatedCents").GetInt64());
        Assert.Equal(10_000, goalRow.GetProperty("allocatedInRangeCents").GetInt64());
        Assert.Equal(2_000, goalRow.GetProperty("progressBasisPoints").GetInt64());

        using var openingRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/investments/opening-values", token);
        openingRequest.Content = JsonContent.Create(new
        {
            idempotencyKey = "report-invest-opening", occurredOn = "2026-07-01", description = "Opening depot",
            amountCents = 100_000,
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(openingRequest)).StatusCode);
        using var valuationRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/investments/valuations", token);
        valuationRequest.Content = JsonContent.Create(new
        {
            idempotencyKey = "report-invest-valuation", occurredOn = "2026-07-20", description = "July valuation",
            amountCents = 110_000,
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(valuationRequest)).StatusCode);

        using var investmentReportRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/reports/investments", token);
        var investmentReport = await (await fixture.Client.SendAsync(investmentReportRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(110_000, investmentReport.GetProperty("currentValueCents").GetInt64());
        Assert.Equal(10_000, investmentReport.GetProperty("gainCents").GetInt64());
        Assert.Equal(1_000, investmentReport.GetProperty("gainBasisPoints").GetInt64());
        Assert.Equal("2026-07-20", investmentReport.GetProperty("latestValuationDate").GetString());
    }

    [Fact]
    public async Task Csv_export_documents_records_with_stable_relationship_identifiers()
    {
        const string token = LegacyParityFixture.CsvExportAccessToken;

        using var categoryRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/categories", token);
        categoryRequest.Content = JsonContent.Create(new { name = "Export Food", color = "#16a34a", icon = "basket", behavior = "include_in_limit" });
        var categoryResponse = await fixture.Client.SendAsync(categoryRequest);
        Assert.Equal(HttpStatusCode.Created, categoryResponse.StatusCode);
        var categoryId = (await categoryResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        using var expenseRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", token);
        expenseRequest.Content = JsonContent.Create(new
        {
            kind = "expense", occurredOn = "2026-07-18", description = "Groceries, weekly",
            amountCents = 10_000, categoryId, merchant = "REWE", affectsOrdinary = true,
        });
        var expenseResponse = await fixture.Client.SendAsync(expenseRequest);
        Assert.Equal(HttpStatusCode.Created, expenseResponse.StatusCode);
        var expenseId = (await expenseResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        using var correctionRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/ledger/entries/{expenseId}/corrections", token);
        correctionRequest.Content = JsonContent.Create(new
        {
            reason = "Receipt total", description = "Groceries, weekly", occurredOn = "2026-07-18",
            amountCents = 12_000, categoryId, affectsOrdinary = true, merchant = "REWE",
        });
        var correctionResponse = await fixture.Client.SendAsync(correctionRequest);
        Assert.Equal(HttpStatusCode.Created, correctionResponse.StatusCode);
        var correctionId = (await correctionResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        using var exportRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/export/transactions", token);
        var exportResponse = await fixture.Client.SendAsync(exportRequest);
        Assert.Equal(HttpStatusCode.OK, exportResponse.StatusCode);
        Assert.Equal("text/csv", exportResponse.Content.Headers.ContentType?.MediaType);
        var transactions = BudgetCsv.Parse(await exportResponse.Content.ReadAsStringAsync());
        Assert.Equal(
            ["id", "kind", "status", "occurredOn", "description", "amount", "ordinaryImpact",
                "category", "merchant", "merchantNormalized", "brandKey", "source", "correctsEntryId", "relatedEntryId"],
            transactions[0]);
        var originalRow = transactions.Single(row => row[0] == expenseId.ToString());
        var correctionRow = transactions.Single(row => row[0] == correctionId.ToString());
        Assert.Equal("corrected", originalRow[2]);
        Assert.Equal("100.00", originalRow[5]);
        Assert.Equal("actual", correctionRow[2]);
        Assert.Equal("120.00", correctionRow[5]);
        Assert.Equal(expenseId.ToString(), correctionRow[12]);
        Assert.Equal("Export Food", correctionRow[7]);
        Assert.Equal("2026-07-18", correctionRow[3]);

        using var splitsRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/export/splits", token);
        var splits = BudgetCsv.Parse(await (await fixture.Client.SendAsync(splitsRequest)).Content.ReadAsStringAsync());
        Assert.Contains(splits.Skip(1), row => row[1] == correctionId.ToString() && row[2] == categoryId.ToString());

        using var categoriesRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/export/categories", token);
        var categories = BudgetCsv.Parse(await (await fixture.Client.SendAsync(categoriesRequest)).Content.ReadAsStringAsync());
        Assert.Contains(categories.Skip(1), row => row[0] == categoryId.ToString() && row[1] == "Export Food");

        using var unknownRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/export/unknown", token);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.Client.SendAsync(unknownRequest)).StatusCode);
        using var anonymousRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/budget/export/transactions");
        Assert.Equal(HttpStatusCode.Unauthorized, (await fixture.Client.SendAsync(anonymousRequest)).StatusCode);
    }

    [Fact]
    public async Task Csv_import_stages_validates_reviews_and_commits_idempotently()
    {
        const string token = LegacyParityFixture.CsvImportAccessToken;
        const string csv = """
            Datum;Art;Beschreibung;Betrag;Kategorie;Haendler
            15.07.2026;Ausgabe;Wocheneinkauf;45,90;Lebensmittel;REWE
            16.07.2026;Einnahme;Gehalt;2.500,00;;
            17.07.2026;Ausgabe;;12,00;;
            32.07.2026;Ausgabe;Kaputt;5,00;;
            15.07.2026;Ausgabe;Wocheneinkauf;45,90;Lebensmittel;REWE
            """;

        using var createRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/import/sessions", token);
        createRequest.Content = JsonContent.Create(new { fileName = "haushalt.csv", content = csv });
        var createResponse = await fixture.Client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var sessionId = created.GetProperty("session").GetProperty("id").GetGuid();
        Assert.Equal(5, created.GetProperty("session").GetProperty("rowCount").GetInt32());
        var suggested = created.GetProperty("suggestedMapping");
        Assert.Equal(0, suggested.GetProperty("dateColumn").GetInt32());
        Assert.Equal(3, suggested.GetProperty("amountColumn").GetInt32());
        Assert.Equal("dd.MM.yyyy", suggested.GetProperty("dateFormat").GetString());
        Assert.Equal(",", suggested.GetProperty("decimalSeparator").GetString());

        using var mappingRequest = Authenticated(HttpMethod.Put, $"/api/v1/budget/import/sessions/{sessionId}/mapping", token);
        mappingRequest.Content = JsonContent.Create(new
        {
            dateColumn = 0, amountColumn = 3, descriptionColumn = 2, kindColumn = 1,
            categoryColumn = 4, merchantColumn = 5, dateFormat = "dd.MM.yyyy", decimalSeparator = ",",
            defaultKind = "expense",
        });
        var mappingResponse = await fixture.Client.SendAsync(mappingRequest);
        Assert.Equal(HttpStatusCode.OK, mappingResponse.StatusCode);
        var preview = await mappingResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3, preview.GetProperty("validRows").GetInt32());
        Assert.Equal(2, preview.GetProperty("invalidRows").GetInt32());
        Assert.Equal(1, preview.GetProperty("duplicateRows").GetInt32());
        var previewRows = preview.GetProperty("rows").EnumerateArray().ToList();
        Assert.Equal("missing_description", previewRows[2].GetProperty("validationError").GetString());
        Assert.Equal("invalid_date", previewRows[3].GetProperty("validationError").GetString());
        Assert.True(previewRows[4].GetProperty("duplicateWarning").GetBoolean());
        Assert.Equal(4_590, previewRows[0].GetProperty("amountCents").GetInt64());
        Assert.Equal(250_000, previewRows[1].GetProperty("amountCents").GetInt64());
        Assert.Equal("income", previewRows[1].GetProperty("kind").GetString());

        using var commitRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/import/sessions/{sessionId}/commit", token);
        commitRequest.Content = JsonContent.Create(new { includeDuplicates = false });
        var commitResponse = await fixture.Client.SendAsync(commitRequest);
        Assert.Equal(HttpStatusCode.OK, commitResponse.StatusCode);
        var committed = await commitResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, committed.GetProperty("importedRows").GetInt32());
        Assert.Equal(2, committed.GetProperty("skippedInvalidRows").GetInt32());
        Assert.Equal(1, committed.GetProperty("skippedDuplicateRows").GetInt32());
        Assert.Equal("committed", committed.GetProperty("session").GetProperty("status").GetString());

        using var retryRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/import/sessions/{sessionId}/commit", token);
        retryRequest.Content = JsonContent.Create(new { includeDuplicates = true });
        var retried = await (await fixture.Client.SendAsync(retryRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, retried.GetProperty("importedRows").GetInt32());

        using var entriesRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/ledger/entries", token);
        var entries = await (await fixture.Client.SendAsync(entriesRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var imported = entries.EnumerateArray().Where(x => x.GetProperty("source").GetString() == "import").ToList();
        Assert.Equal(2, imported.Count);
        var importedExpense = imported.Single(x => x.GetProperty("kind").GetString() == "expense");
        Assert.Equal(4_590, importedExpense.GetProperty("amountCents").GetInt64());
        Assert.Equal("REWE", importedExpense.GetProperty("merchantNormalized").GetString());
        Assert.Equal("Lebensmittel", importedExpense.GetProperty("splits")[0].GetProperty("categoryNameSnapshot").GetString());

        using var lateMappingRequest = Authenticated(HttpMethod.Put, $"/api/v1/budget/import/sessions/{sessionId}/mapping", token);
        lateMappingRequest.Content = JsonContent.Create(new
        {
            dateColumn = 0, amountColumn = 3, dateFormat = "dd.MM.yyyy", decimalSeparator = ",",
        });
        Assert.Equal(HttpStatusCode.Conflict, (await fixture.Client.SendAsync(lateMappingRequest)).StatusCode);

        using var intruderRequest = Authenticated(
            HttpMethod.Get, $"/api/v1/budget/import/sessions/{sessionId}", LegacyParityFixture.ReportsIntruderAccessToken);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.Client.SendAsync(intruderRequest)).StatusCode);
        using var anonymousRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/budget/import/sessions");
        anonymousRequest.Content = JsonContent.Create(new { content = "a,b\n1,2" });
        Assert.Equal(HttpStatusCode.Unauthorized, (await fixture.Client.SendAsync(anonymousRequest)).StatusCode);
    }

    [Fact]
    public async Task Csv_export_import_round_trip_preserves_relationships_and_totals()
    {
        const string sourceToken = LegacyParityFixture.CsvSourceAccessToken;
        const string targetToken = LegacyParityFixture.CsvTargetAccessToken;

        using var categoryRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/categories", sourceToken);
        categoryRequest.Content = JsonContent.Create(new { name = "Roundtrip Food", color = "#16a34a", icon = "basket", behavior = "include_in_limit" });
        var categoryId = (await (await fixture.Client.SendAsync(categoryRequest)).Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();
        using var expenseRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", sourceToken);
        expenseRequest.Content = JsonContent.Create(new
        {
            kind = "expense", occurredOn = "2026-07-18", description = "Groceries, weekly",
            amountCents = 4_590, categoryId, merchant = "REWE", affectsOrdinary = true,
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(expenseRequest)).StatusCode);
        using var incomeRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/ledger/entries", sourceToken);
        incomeRequest.Content = JsonContent.Create(new
        {
            kind = "income", occurredOn = "2026-07-15", description = "Salary", amountCents = 100_000,
        });
        Assert.Equal(HttpStatusCode.Created, (await fixture.Client.SendAsync(incomeRequest)).StatusCode);

        using var exportRequest = Authenticated(HttpMethod.Get, "/api/v1/budget/export/transactions", sourceToken);
        var exported = await (await fixture.Client.SendAsync(exportRequest)).Content.ReadAsStringAsync();

        using var createRequest = Authenticated(HttpMethod.Post, "/api/v1/budget/import/sessions", targetToken);
        createRequest.Content = JsonContent.Create(new { fileName = "budget-transactions.csv", content = exported });
        var created = await (await fixture.Client.SendAsync(createRequest)).Content.ReadFromJsonAsync<JsonElement>();
        var sessionId = created.GetProperty("session").GetProperty("id").GetGuid();
        using var mappingRequest = Authenticated(HttpMethod.Put, $"/api/v1/budget/import/sessions/{sessionId}/mapping", targetToken);
        mappingRequest.Content = JsonContent.Create(new
        {
            dateColumn = 3, amountColumn = 5, descriptionColumn = 4, kindColumn = 1,
            categoryColumn = 7, merchantColumn = 8, dateFormat = "yyyy-MM-dd", decimalSeparator = ".",
            defaultKind = "expense",
        });
        var preview = await (await fixture.Client.SendAsync(mappingRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, preview.GetProperty("validRows").GetInt32());
        Assert.Equal(0, preview.GetProperty("invalidRows").GetInt32());
        using var commitRequest = Authenticated(HttpMethod.Post, $"/api/v1/budget/import/sessions/{sessionId}/commit", targetToken);
        commitRequest.Content = JsonContent.Create(new { includeDuplicates = false });
        var committed = await (await fixture.Client.SendAsync(commitRequest)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, committed.GetProperty("importedRows").GetInt32());

        async Task<(long NetSpent, long Income, string CategoryName)> Report(string token)
        {
            using var spendRequest = Authenticated(
                HttpMethod.Get, "/api/v1/budget/reports/category-spend?from=2026-07-01&through=2026-07-23", token);
            var spend = await (await fixture.Client.SendAsync(spendRequest)).Content.ReadFromJsonAsync<JsonElement>();
            using var incomeReportRequest = Authenticated(
                HttpMethod.Get, "/api/v1/budget/reports/income?from=2026-07-01&through=2026-07-23", token);
            var income = await (await fixture.Client.SendAsync(incomeReportRequest)).Content.ReadFromJsonAsync<JsonElement>();
            return (
                spend.GetProperty("totalNetSpentCents").GetInt64(),
                income.GetProperty("actualCents").GetInt64(),
                spend.GetProperty("rows")[0].GetProperty("name").GetString()!);
        }

        var source = await Report(sourceToken);
        var target = await Report(targetToken);
        Assert.Equal(source.NetSpent, target.NetSpent);
        Assert.Equal(source.Income, target.Income);
        Assert.Equal("Roundtrip Food", source.CategoryName);
        Assert.Equal("Roundtrip Food", target.CategoryName);
    }

    private static HttpRequestMessage Authenticated(HttpMethod method, string path, string token = LegacyParityFixture.AccessToken)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }
}
