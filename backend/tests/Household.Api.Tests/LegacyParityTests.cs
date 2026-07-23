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

    private static HttpRequestMessage Authenticated(HttpMethod method, string path, string token = LegacyParityFixture.AccessToken)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }
}
