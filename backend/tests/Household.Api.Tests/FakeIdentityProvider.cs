using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Household.Api.Tests;

/// <summary>
/// Stands in for Pocket ID at the HTTP boundary: serves discovery, JWKS and the token endpoint,
/// and enforces what a real provider enforces (client secret, single-use codes, redirect URI, PKCE).
/// Tests call <see cref="SignIn"/> to play the user approving the login in the browser.
/// </summary>
public sealed class FakeIdentityProvider(string issuer, string clientId, string clientSecret, DateTimeOffset now) : HttpMessageHandler
{
    private readonly RsaSecurityKey _signingKey = new RsaSecurityKey(RSA.Create(2048)) { KeyId = "provider-key" };
    private readonly ConcurrentDictionary<string, Grant> _grants = new ConcurrentDictionary<string, Grant>();

    public string Issuer { get; } = issuer;

    /// <summary>
    /// Approves the authorization request Household redirected the browser to and returns what the
    /// provider appends to the callback. <paramref name="tamper"/> forges the ID token for rejection tests.
    /// </summary>
    public Callback SignIn(string authorizationUrl, ProviderUser user, IdTokenTamper? tamper = null)
    {
        Uri uri = new Uri(authorizationUrl);
        if (uri.GetLeftPart(UriPartial.Path) != $"{this.Issuer}/authorize")
            throw new InvalidOperationException($"Unexpected authorization endpoint {uri}");
        Dictionary<string, string> query = QueryHelpers.ParseQuery(uri.Query)
            .ToDictionary(pair => pair.Key, pair => pair.Value.ToString());
        if (query["client_id"] != clientId || query["response_type"] != "code" || query["code_challenge_method"] != "S256" ||
            !query["scope"].Split(' ').Contains("openid"))
        {
            throw new InvalidOperationException($"Malformed authorization request {uri}");
        }

        string code = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16));
        this._grants[code] = new Grant(user, query["nonce"], query["code_challenge"], query["redirect_uri"], tamper ?? new IdTokenTamper());
        return new Callback(code, query["state"]);
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        string path = request.RequestUri!.GetLeftPart(UriPartial.Path);
        if (request.Method == HttpMethod.Get && path == $"{this.Issuer}/.well-known/openid-configuration")
        {
            return Json(new Dictionary<string, object>
            {
                ["issuer"] = this.Issuer,
                ["authorization_endpoint"] = $"{this.Issuer}/authorize",
                ["token_endpoint"] = $"{this.Issuer}/api/oidc/token",
                ["jwks_uri"] = $"{this.Issuer}/.well-known/jwks.json",
                ["response_types_supported"] = new[] { "code" },
                ["id_token_signing_alg_values_supported"] = new[] { "RS256" },
            });
        }

        if (request.Method == HttpMethod.Get && path == $"{this.Issuer}/.well-known/jwks.json")
        {
            JsonWebKey key = JsonWebKeyConverter.ConvertFromRSASecurityKey(this._signingKey);
            return Json(new { keys = new[] { new { kty = key.Kty, kid = key.Kid, use = "sig", alg = "RS256", n = key.N, e = key.E } } });
        }

        if (request.Method == HttpMethod.Post && path == $"{this.Issuer}/api/oidc/token")
        {
            Dictionary<string, string> form = QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(cancellationToken))
                .ToDictionary(pair => pair.Key, pair => pair.Value.ToString());
            return this.Token(request, form);
        }

        return new HttpResponseMessage(HttpStatusCode.NotFound);
    }

    private HttpResponseMessage Token(HttpRequestMessage request, Dictionary<string, string> form)
    {
        if (!this.ClientAuthenticated(request, form)) return Error(HttpStatusCode.Unauthorized, "invalid_client");
        if (form.GetValueOrDefault("grant_type") != "authorization_code" ||
            !this._grants.TryRemove(form.GetValueOrDefault("code") ?? "", out Grant? grant) ||
            form.GetValueOrDefault("redirect_uri") != grant.RedirectUri ||
            Challenge(form.GetValueOrDefault("code_verifier") ?? "") != grant.CodeChallenge)
        {
            return Error(HttpStatusCode.BadRequest, "invalid_grant");
        }

        SecurityKey key = grant.Tamper.ForeignKey ? new RsaSecurityKey(RSA.Create(2048)) { KeyId = "provider-key" } : this._signingKey;
        Dictionary<string, object> claims = new Dictionary<string, object>
        {
            ["sub"] = grant.User.Subject,
            ["email"] = grant.User.Email,
            ["name"] = grant.User.Name,
            ["preferred_username"] = grant.User.PreferredUsername,
            ["nonce"] = grant.Tamper.Nonce ?? grant.Nonce,
        };
        string idToken = new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false }.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = grant.Tamper.Issuer ?? this.Issuer,
            Audience = grant.Tamper.Audience ?? clientId,
            Claims = claims,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = now.UtcDateTime.Add(grant.Tamper.Lifetime ?? TimeSpan.FromMinutes(5)),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.RsaSha256),
        });
        return Json(new { access_token = "provider-access-token", token_type = "Bearer", expires_in = 300, id_token = idToken });
    }

    private bool ClientAuthenticated(HttpRequestMessage request, Dictionary<string, string> form)
    {
        if (request.Headers.Authorization is { Scheme: "Basic", Parameter: { } parameter })
        {
            string[] parts = Encoding.UTF8.GetString(Convert.FromBase64String(parameter)).Split(':', 2);
            return parts.Length == 2 && Uri.UnescapeDataString(parts[0]) == clientId && Uri.UnescapeDataString(parts[1]) == clientSecret;
        }

        return form.GetValueOrDefault("client_id") == clientId && form.GetValueOrDefault("client_secret") == clientSecret;
    }

    private static string Challenge(string verifier) => Base64UrlEncoder.Encode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));

    private static HttpResponseMessage Json(object body) => new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(body) };

    private static HttpResponseMessage Error(HttpStatusCode status, string error) =>
        new HttpResponseMessage(status) { Content = JsonContent.Create(new { error }) };

    private sealed record Grant(ProviderUser User, string Nonce, string CodeChallenge, string RedirectUri, IdTokenTamper Tamper);
}

/// <summary>A person as the identity provider knows them.</summary>
public sealed record ProviderUser(string Subject, string Email, string Name, string PreferredUsername);

/// <summary>What the callback URL carries back to Household.</summary>
public sealed record Callback(string Code, string State);

/// <summary>Forgeries for the ID token; unset fields keep the honest value.</summary>
public sealed record IdTokenTamper(string? Audience = null, string? Issuer = null, string? Nonce = null, bool ForeignKey = false, TimeSpan? Lifetime = null);
