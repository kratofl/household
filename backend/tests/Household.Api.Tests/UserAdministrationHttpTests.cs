using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Household.Api.Tests;

public sealed class UserAdministrationHttpTests(OidcFixture fixture) : IClassFixture<OidcFixture>
{
    private OidcFixture Fixture { get; } = fixture;

    [Fact]
    public async Task Admin_activates_a_pending_user_and_can_block_and_restore_it()
    {
        using HttpClient admin = await this.Admin("ulla");
        await this.Fixture.CreatePasswordUser("vera", "vera-password", status: "pending");
        Assert.Equal(HttpStatusCode.Forbidden, await this.LoginStatus("vera", "vera-password"));

        Guid vera = (await this.Users(admin)).Single(x => x.Name == "vera").Id;
        using HttpResponseMessage activated = await admin.PatchAsJsonAsync($"/api/v1/users/{vera}", new { status = "active" });
        Assert.Equal(HttpStatusCode.OK, activated.StatusCode);
        Assert.Equal(HttpStatusCode.OK, await this.LoginStatus("vera", "vera-password"));

        using HttpResponseMessage blocked = await admin.PatchAsJsonAsync($"/api/v1/users/{vera}", new { status = "blocked" });
        Assert.Equal(HttpStatusCode.OK, blocked.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, await this.LoginStatus("vera", "vera-password"));
        Assert.Equal("blocked", (await this.Users(admin)).Single(x => x.Id == vera).Status);

        using HttpResponseMessage restored = await admin.PatchAsJsonAsync($"/api/v1/users/{vera}", new { status = "active" });
        Assert.Equal(HttpStatusCode.OK, restored.StatusCode);
        Assert.Equal(HttpStatusCode.OK, await this.LoginStatus("vera", "vera-password"));
    }

    [Fact]
    public async Task Admin_role_can_be_granted_and_taken_but_never_by_users_or_on_the_own_account()
    {
        using HttpClient admin = await this.Admin("wanda");
        await this.Fixture.CreatePasswordUser("xaver", "xaver-password");
        using HttpClient xaver = this.Fixture.Client;
        xaver.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await this.Fixture.PasswordLogin("xaver", "xaver-password"));
        List<ListedUser> users = await this.Users(admin);
        Guid wandaId = users.Single(x => x.Name == "wanda").Id;
        Guid xaverId = users.Single(x => x.Name == "xaver").Id;

        using HttpResponseMessage selfPromotion = await xaver.PatchAsJsonAsync($"/api/v1/users/{xaverId}", new { role = "admin" });
        Assert.Equal(HttpStatusCode.Forbidden, selfPromotion.StatusCode);
        using HttpResponseMessage ownAccount = await admin.PatchAsJsonAsync($"/api/v1/users/{wandaId}", new { role = "user" });
        Assert.Equal(HttpStatusCode.Conflict, ownAccount.StatusCode);
        using HttpResponseMessage unknownStatus = await admin.PatchAsJsonAsync($"/api/v1/users/{xaverId}", new { status = "pending" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, unknownStatus.StatusCode);

        using HttpResponseMessage promoted = await admin.PatchAsJsonAsync($"/api/v1/users/{xaverId}", new { role = "admin" });
        Assert.Equal(HttpStatusCode.OK, promoted.StatusCode);
        using HttpResponseMessage asAdmin = await xaver.GetAsync("/api/v1/users");
        Assert.Equal(HttpStatusCode.OK, asAdmin.StatusCode);

        using HttpResponseMessage demoted = await admin.PatchAsJsonAsync($"/api/v1/users/{xaverId}", new { role = "user" });
        Assert.Equal(HttpStatusCode.OK, demoted.StatusCode);
        using HttpResponseMessage asUser = await xaver.GetAsync("/api/v1/users");
        Assert.Equal(HttpStatusCode.Forbidden, asUser.StatusCode);
    }

    [Fact]
    public async Task Admin_creates_an_active_user_that_can_sign_in_right_away()
    {
        using HttpClient admin = await this.Admin("yara");
        using HttpResponseMessage created = await admin.PutAsJsonAsync("/api/v1/users/", new
        {
            name = " Yuki ",
            email = "yuki@household.test",
            password = "yuki-password",
        });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        ListedUser yuki = (await this.Users(admin)).Single(x => x.Name == "yuki");
        Assert.Equal(("user", "active"), (yuki.Role, yuki.Status));
        Assert.Equal(HttpStatusCode.OK, await this.LoginStatus("yuki", "yuki-password"));

        using HttpResponseMessage duplicate = await admin.PutAsJsonAsync("/api/v1/users/", new
        {
            name = "yuki",
            email = "other@household.test",
            password = "other-password",
        });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        // The web client translates the code; the English detail stays for other API readers.
        JsonElement problem = await duplicate.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("user_exists", problem.GetProperty("code").GetString());
        Assert.Equal("A user with this name or email already exists", problem.GetProperty("detail").GetString());
        using HttpResponseMessage incomplete = await admin.PutAsJsonAsync("/api/v1/users/", new { name = "zoe" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, incomplete.StatusCode);

        using HttpClient anonymous = this.Fixture.Client;
        using HttpResponseMessage anonymousCreate = await anonymous.PutAsJsonAsync("/api/v1/users/", new
        {
            name = "mallory",
            email = "mallory@household.test",
            password = "mallory-password",
        });
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousCreate.StatusCode);

        using HttpClient yukiClient = this.Fixture.Client;
        yukiClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await this.Fixture.PasswordLogin("yuki", "yuki-password"));
        using HttpResponseMessage userCreate = await yukiClient.PutAsJsonAsync("/api/v1/users/", new
        {
            name = "mallory",
            email = "mallory@household.test",
            password = "mallory-password",
        });
        Assert.Equal(HttpStatusCode.Forbidden, userCreate.StatusCode);
    }

    private async Task<HttpClient> Admin(string name)
    {
        await this.Fixture.CreatePasswordUser(name, $"{name}-password", role: "admin");
        HttpClient client = this.Fixture.Client;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await this.Fixture.PasswordLogin(name, $"{name}-password"));
        return client;
    }

    private async Task<HttpStatusCode> LoginStatus(string name, string password)
    {
        using HttpClient client = this.Fixture.Client;
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/v1/auth/authorize", new { username = name, password });
        return response.StatusCode;
    }

    private async Task<List<ListedUser>> Users(HttpClient client) =>
        (await client.GetFromJsonAsync<List<ListedUser>>("/api/v1/users"))!;

    private sealed record ListedUser(Guid Id, string Name, string Role, string Status);
}
