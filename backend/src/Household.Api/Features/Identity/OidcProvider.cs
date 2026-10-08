using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Household.Api.Features.Identity;

/// <summary>The person the provider vouched for in a validated ID token.</summary>
public sealed record OidcIdentity(string Issuer, string Subject, string? Email, string? PreferredUsername);

/// <summary>The provider could not be reached or its discovery document is unusable.</summary>
public sealed class OidcProviderUnavailableException(string message, Exception inner) : Exception(message, inner);

/// <summary>
/// HTTP adapter to the configured OpenID Connect provider. Discovery and keys are fetched per call:
/// logins are rare and this way a rotated provider key is picked up without a restart.
/// </summary>
public sealed class OidcProvider(HttpClient http, OidcSettings settings, TimeProvider timeProvider, ILogger<OidcProvider> logger)
{
    private static readonly TimeSpan ClockSkew = TimeSpan.FromMinutes(1);

    /// <summary>Where to send the browser: an authorization code request bound to state, nonce and a PKCE challenge.</summary>
    public async Task<string> AuthorizationUrlAsync(string state, string nonce, string codeVerifier, string redirectUri, CancellationToken cancellationToken)
    {
        OpenIdConnectConfiguration configuration = await this.DiscoverAsync(cancellationToken);
        return QueryHelpers.AddQueryString(configuration.AuthorizationEndpoint, new Dictionary<string, string?>
        {
            ["response_type"] = "code",
            ["client_id"] = settings.ClientId,
            ["redirect_uri"] = redirectUri,
            ["scope"] = "openid profile email",
            ["state"] = state,
            ["nonce"] = nonce,
            ["code_challenge"] = Base64UrlEncoder.Encode(SHA256.HashData(Encoding.ASCII.GetBytes(codeVerifier))),
            ["code_challenge_method"] = "S256",
        });
    }

    /// <summary>
    /// Exchanges the callback's code and validates the ID token (signature, issuer, audience, lifetime, nonce).
    /// Null when the provider refuses the code or the token does not check out; the reason is logged, not returned.
    /// </summary>
    public async Task<OidcIdentity?> RedeemAsync(string code, string codeVerifier, string redirectUri, string nonce, CancellationToken cancellationToken)
    {
        OpenIdConnectConfiguration configuration = await this.DiscoverAsync(cancellationToken);
        using HttpResponseMessage response = await this.RequestTokenAsync(configuration.TokenEndpoint, code, codeVerifier, redirectUri, cancellationToken);
        string body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("OIDC token endpoint refused the code with {Status}: {Body}", (int)response.StatusCode, body);
            return null;
        }

        if (ReadIdToken(body) is not { } idToken)
        {
            logger.LogWarning("OIDC token response carried no id_token");
            return null;
        }

        TokenValidationResult result = await new JsonWebTokenHandler().ValidateTokenAsync(idToken, new TokenValidationParameters
        {
            ValidIssuer = configuration.Issuer,
            ValidAudience = settings.ClientId,
            IssuerSigningKeys = configuration.SigningKeys,
            RequireExpirationTime = true,
            LifetimeValidator = this.WithinLifetime,
        });
        if (!result.IsValid)
        {
            logger.LogWarning(result.Exception, "OIDC ID token rejected");
            return null;
        }

        if (Claim(result, "nonce") != nonce || Claim(result, "sub") is not { Length: > 0 } subject)
        {
            logger.LogWarning("OIDC ID token has a foreign nonce or no subject");
            return null;
        }

        return new OidcIdentity(configuration.Issuer, subject, Claim(result, "email"), Claim(result, "preferred_username"));
    }

    private async Task<OpenIdConnectConfiguration> DiscoverAsync(CancellationToken cancellationToken)
    {
        try
        {
            HttpDocumentRetriever retriever = new HttpDocumentRetriever(http)
            {
                RequireHttps = settings.Issuer.StartsWith("https://", StringComparison.OrdinalIgnoreCase),
            };
            OpenIdConnectConfiguration configuration = await OpenIdConnectConfigurationRetriever.GetAsync(
                $"{settings.Issuer}/.well-known/openid-configuration", retriever, cancellationToken);
            if (configuration.Issuer.TrimEnd('/') != settings.Issuer)
                throw new InvalidOperationException($"Provider reports issuer {configuration.Issuer}, expected {settings.Issuer}.");
            return configuration;
        }
        catch (Exception error) when (error is IOException or HttpRequestException or InvalidOperationException or ArgumentException)
        {
            logger.LogError(error, "OIDC discovery at {Issuer} failed", settings.Issuer);
            throw new OidcProviderUnavailableException($"OIDC discovery at {settings.Issuer} failed.", error);
        }
    }

    private async Task<HttpResponseMessage> RequestTokenAsync(string tokenEndpoint, string code, string codeVerifier, string redirectUri, CancellationToken cancellationToken)
    {
        using FormUrlEncodedContent form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = redirectUri,
            ["code_verifier"] = codeVerifier,
            ["client_id"] = settings.ClientId,
            ["client_secret"] = settings.ClientSecret,
        });
        try
        {
            return await http.PostAsync(tokenEndpoint, form, cancellationToken);
        }
        catch (HttpRequestException error)
        {
            throw new OidcProviderUnavailableException($"OIDC token endpoint {tokenEndpoint} unreachable.", error);
        }
    }

    private bool WithinLifetime(DateTime? notBefore, DateTime? expires, SecurityToken token, TokenValidationParameters parameters)
    {
        DateTime now = timeProvider.GetUtcNow().UtcDateTime;
        return expires is { } expiry && expiry.ToUniversalTime() > now - ClockSkew &&
            (notBefore is not { } start || start.ToUniversalTime() <= now + ClockSkew);
    }

    private static string? ReadIdToken(string body)
    {
        try
        {
            using JsonDocument document = JsonDocument.Parse(body);
            return document.RootElement.ValueKind == JsonValueKind.Object &&
                document.RootElement.TryGetProperty("id_token", out JsonElement idToken) && idToken.ValueKind == JsonValueKind.String
                ? idToken.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Claim(TokenValidationResult result, string type) =>
        result.Claims.TryGetValue(type, out object? value) && value is string text ? text : null;
}
