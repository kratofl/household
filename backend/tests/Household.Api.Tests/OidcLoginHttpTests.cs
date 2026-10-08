using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Household.Api.Features.Identity;

namespace Household.Api.Tests;

public sealed class OidcLoginHttpTests(OidcFixture fixture) : IClassFixture<OidcFixture>
{
    private OidcFixture Fixture { get; } = fixture;

    [Fact]
    public async Task Login_screen_offers_the_provider_only_when_configured()
    {
        using HttpClient enabled = this.Fixture.Client;
        Assert.Equal(new OidcOffer(true, "Pocket ID"), await enabled.GetFromJsonAsync<OidcOffer>("/api/v1/auth/oidc"));

        using HttpClient disabled = this.Fixture.DisabledClient;
        Assert.Equal(new OidcOffer(false, null), await disabled.GetFromJsonAsync<OidcOffer>("/api/v1/auth/oidc"));
    }

    [Fact]
    public async Task Linked_account_signs_in_through_the_provider()
    {
        await this.Fixture.CreatePasswordUser("anna", "anna-password");
        string annaToken = await this.Fixture.PasswordLogin("anna", "anna-password");
        ProviderUser anna = new ProviderUser("pocket-anna", "anna@pocket.test", "Anna", "anna.pocket");

        using HttpClient signedIn = this.Fixture.Client;
        signedIn.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", annaToken);
        Callback linkCallback = this.Fixture.Provider.SignIn(await StartAsync(signedIn, link: true), anna);
        using HttpResponseMessage linked = await signedIn.PostAsJsonAsync("/api/v1/auth/oidc/callback", linkCallback);
        Assert.Equal(HttpStatusCode.NoContent, linked.StatusCode);
        Assert.True((await signedIn.GetFromJsonAsync<Me>("/api/v1/users/me"))!.OidcLinked);

        using HttpClient anonymous = this.Fixture.Client;
        Callback loginCallback = this.Fixture.Provider.SignIn(await StartAsync(anonymous, link: false), anna);
        using HttpResponseMessage login = await anonymous.PostAsJsonAsync("/api/v1/auth/oidc/callback", loginCallback);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        TokenPair tokens = (await login.Content.ReadFromJsonAsync<TokenPair>())!;

        using HttpClient viaProvider = this.Fixture.Client;
        viaProvider.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);
        Assert.Equal("anna", (await viaProvider.GetFromJsonAsync<Me>("/api/v1/users/me"))!.Name);
    }

    [Fact]
    public async Task Unknown_provider_user_waits_for_approval_and_never_takes_over_an_existing_account()
    {
        await this.Fixture.CreatePasswordUser("bert", "bert-password");
        await this.Fixture.CreatePasswordUser("root", "root-password", role: "admin");
        using HttpClient anonymous = this.Fixture.Client;

        ProviderUser impostor = new ProviderUser("pocket-impostor", "bert@household.test", "Not Bert", "not-bert");
        using HttpResponseMessage takeover = await anonymous.PostAsJsonAsync("/api/v1/auth/oidc/callback",
            this.Fixture.Provider.SignIn(await StartAsync(anonymous, link: false), impostor));
        Assert.Equal(HttpStatusCode.Conflict, takeover.StatusCode);

        ProviderUser carla = new ProviderUser("pocket-carla", "Carla@Pocket.test", "Carla", "Carla");
        foreach (int attempt in new[] { 1, 2 })
        {
            using HttpResponseMessage pending = await anonymous.PostAsJsonAsync("/api/v1/auth/oidc/callback",
                this.Fixture.Provider.SignIn(await StartAsync(anonymous, link: false), carla));
            Assert.Equal(HttpStatusCode.Forbidden, pending.StatusCode);
        }

        using HttpClient admin = this.Fixture.Client;
        admin.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await this.Fixture.PasswordLogin("root", "root-password"));
        List<Me> users = (await admin.GetFromJsonAsync<List<Me>>("/api/v1/users"))!;
        Assert.Equal(new Me("bert", "active", false), users.Single(x => x.Name == "bert"));
        Assert.Equal(new Me("carla", "pending", true), users.Single(x => x.Name == "carla"));
        Assert.DoesNotContain(users, x => x.Name == "not-bert");
    }

    public static TheoryData<string, IdTokenTamper> ForgedTokens => new TheoryData<string, IdTokenTamper>
    {
        { "audience", new IdTokenTamper(Audience: "another-app") },
        { "issuer", new IdTokenTamper(Issuer: "https://evil.test") },
        { "nonce", new IdTokenTamper(Nonce: "nonce-of-another-login") },
        { "key", new IdTokenTamper(ForeignKey: true) },
        { "expired", new IdTokenTamper(Lifetime: TimeSpan.FromMinutes(-10)) },
    };

    [Theory]
    [MemberData(nameof(ForgedTokens))]
    public async Task Forged_id_token_does_not_sign_in(string forgery, IdTokenTamper tamper)
    {
        ProviderUser person = await this.LinkedUser($"forged-{forgery}");
        using HttpClient anonymous = this.Fixture.Client;
        using HttpResponseMessage response = await anonymous.PostAsJsonAsync("/api/v1/auth/oidc/callback",
            this.Fixture.Provider.SignIn(await StartAsync(anonymous, link: false), person, tamper));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Callback_is_accepted_once_and_only_for_a_started_login()
    {
        ProviderUser person = await this.LinkedUser("erik");
        using HttpClient anonymous = this.Fixture.Client;
        Callback callback = this.Fixture.Provider.SignIn(await StartAsync(anonymous, link: false), person);

        using HttpResponseMessage first = await anonymous.PostAsJsonAsync("/api/v1/auth/oidc/callback", callback);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        using HttpResponseMessage replay = await anonymous.PostAsJsonAsync("/api/v1/auth/oidc/callback", callback);
        Assert.Equal(HttpStatusCode.BadRequest, replay.StatusCode);
        using HttpResponseMessage madeUp = await anonymous.PostAsJsonAsync("/api/v1/auth/oidc/callback", callback with { State = "made-up" });
        Assert.Equal(HttpStatusCode.BadRequest, madeUp.StatusCode);
    }

    [Fact]
    public async Task Provider_account_links_to_one_user_only()
    {
        ProviderUser hanna = await this.LinkedUser("hanna");
        await this.Fixture.CreatePasswordUser("ida", "ida-password");
        using HttpClient ida = this.Fixture.Client;
        ida.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await this.Fixture.PasswordLogin("ida", "ida-password"));

        using HttpResponseMessage response = await ida.PostAsJsonAsync("/api/v1/auth/oidc/callback",
            this.Fixture.Provider.SignIn(await StartAsync(ida, link: true), hanna));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.False((await ida.GetFromJsonAsync<Me>("/api/v1/users/me"))!.OidcLinked);
    }

    [Fact]
    public async Task Unlinked_provider_account_no_longer_signs_in_as_the_user()
    {
        ProviderUser fia = await this.LinkedUser("fia");
        using HttpClient signedIn = this.Fixture.Client;
        signedIn.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await this.Fixture.PasswordLogin("fia", "fia-password"));

        using HttpResponseMessage unlinked = await signedIn.DeleteAsync("/api/v1/users/me/oidc");
        Assert.Equal(HttpStatusCode.NoContent, unlinked.StatusCode);
        Assert.False((await signedIn.GetFromJsonAsync<Me>("/api/v1/users/me"))!.OidcLinked);

        using HttpClient anonymous = this.Fixture.Client;
        using HttpResponseMessage login = await anonymous.PostAsJsonAsync("/api/v1/auth/oidc/callback",
            this.Fixture.Provider.SignIn(await StartAsync(anonymous, link: false), fia));
        Assert.Equal(HttpStatusCode.Conflict, login.StatusCode);
    }

    [Fact]
    public async Task Account_created_through_the_provider_keeps_its_only_way_in()
    {
        ProviderUser gus = new ProviderUser("pocket-gus", "gus@pocket.test", "Gus", "gus");
        using HttpClient anonymous = this.Fixture.Client;
        using HttpResponseMessage pending = await anonymous.PostAsJsonAsync("/api/v1/auth/oidc/callback",
            this.Fixture.Provider.SignIn(await StartAsync(anonymous, link: false), gus));
        Assert.Equal(HttpStatusCode.Forbidden, pending.StatusCode);
        await this.Fixture.Activate("gus");

        using HttpResponseMessage login = await anonymous.PostAsJsonAsync("/api/v1/auth/oidc/callback",
            this.Fixture.Provider.SignIn(await StartAsync(anonymous, link: false), gus));
        TokenPair tokens = (await login.Content.ReadFromJsonAsync<TokenPair>())!;
        using HttpClient signedIn = this.Fixture.Client;
        signedIn.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);
        using HttpResponseMessage unlink = await signedIn.DeleteAsync("/api/v1/users/me/oidc");
        Assert.Equal(HttpStatusCode.Conflict, unlink.StatusCode);
        Assert.True((await signedIn.GetFromJsonAsync<Me>("/api/v1/users/me"))!.OidcLinked);

        foreach (string guess in new[] { "", "gus" })
        {
            using HttpResponseMessage passwordLogin = await anonymous.PostAsJsonAsync("/api/v1/auth/authorize", new { username = "gus", password = guess });
            Assert.Equal(HttpStatusCode.Unauthorized, passwordLogin.StatusCode);
        }
        using HttpResponseMessage changePassword = await signedIn.PutAsJsonAsync("/api/v1/users/me/password", new { currentPassword = "", newPassword = "new-password" });
        Assert.Equal(HttpStatusCode.Forbidden, changePassword.StatusCode);
    }

    /// <summary>A password user who has linked a provider account; returns that provider account.</summary>
    private async Task<ProviderUser> LinkedUser(string name)
    {
        await this.Fixture.CreatePasswordUser(name, $"{name}-password");
        ProviderUser person = new ProviderUser($"pocket-{name}", $"{name}@pocket.test", name, name);
        using HttpClient signedIn = this.Fixture.Client;
        signedIn.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await this.Fixture.PasswordLogin(name, $"{name}-password"));
        using HttpResponseMessage linked = await signedIn.PostAsJsonAsync("/api/v1/auth/oidc/callback",
            this.Fixture.Provider.SignIn(await StartAsync(signedIn, link: true), person));
        Assert.Equal(HttpStatusCode.NoContent, linked.StatusCode);
        return person;
    }

    /// <summary>Starts a provider login (or link, for the signed-in client) and returns where the browser goes next.</summary>
    private static async Task<string> StartAsync(HttpClient client, bool link)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/v1/auth/oidc/start", new { redirectUri = OidcFixture.RedirectUri, link });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<OidcStart>())!.AuthorizationUrl;
    }

    private sealed record OidcOffer(bool Enabled, string? Name);

    private sealed record OidcStart(string AuthorizationUrl);

    private sealed record Me(string Name, string Status, bool OidcLinked);
}
