using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Cryptography;

namespace Household.Api.Features.Identity;

/// <summary>
/// Login through the configured OIDC provider. The API runs the whole authorization code flow
/// (state, nonce, PKCE, code exchange, ID token validation) so the client secret never reaches the
/// browser; the browser only follows the authorization URL and hands the callback's code back.
///
/// A provider account reaches a Household account in one of two ways: a signed-in user links it
/// (start with <c>link: true</c>), or an unknown provider user signs in and is registered as
/// pending for an admin to approve, like a password registration.
/// </summary>
public static class OidcEndpoints
{
    private static readonly TimeSpan LoginLifetime = TimeSpan.FromMinutes(10);

    public static RouteGroupBuilder MapOidcEndpoints(this RouteGroupBuilder auth)
    {
        auth.MapGet("/oidc", Offer);
        auth.MapPost("/oidc/start", Start);
        auth.MapPost("/oidc/callback", Callback);
        return auth;
    }

    /// <summary>Tells the login screen whether to show the provider button and what to call it.</summary>
    private static IResult Offer(OidcSettings settings) =>
        Results.Ok(settings.Enabled ? new OidcOffer(true, settings.Name) : new OidcOffer(false, null));

    private static async Task<IResult> Start(
        StartRequest request,
        HttpContext context,
        OidcSettings settings,
        OidcProvider provider,
        IIdentityAccess identity,
        IdentityDbContext database,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        if (!settings.Enabled) return NotConfigured();
        string redirectUri = request.RedirectUri ?? "";
        if (!Uri.TryCreate(redirectUri, UriKind.Absolute, out Uri? redirect) || redirect.Scheme is not ("http" or "https"))
            return HttpResults.Problem(422, "Validation failed", "redirectUri must be an absolute http(s) URL");

        Guid? linkUserId = null;
        if (request.Link)
        {
            CurrentUser? current = await identity.CurrentUserAsync(context, cancellationToken);
            if (current is null) return HttpResults.Problem(401, "Unauthorized", "Sign in before linking an account");
            linkUserId = current.Id;
        }

        string state = NewSecret();
        string nonce = NewSecret();
        string codeVerifier = NewSecret();
        string authorizationUrl;
        try
        {
            authorizationUrl = await provider.AuthorizationUrlAsync(state, nonce, codeVerifier, redirectUri, cancellationToken);
        }
        catch (OidcProviderUnavailableException)
        {
            return Unavailable(settings);
        }

        // Logins abandoned at the provider never come back; sweep them here instead of in a background job.
        DateTime now = DateTime.SpecifyKind(timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Unspecified);
        await database.OidcLogins.Where(x => x.ExpiresAt < now).ExecuteDeleteAsync(cancellationToken);
        database.OidcLogins.Add(new OidcLogin
        {
            StateHash = TokenFactory.Hash(state),
            Nonce = nonce,
            CodeVerifier = codeVerifier,
            RedirectUri = redirectUri,
            LinkUserId = linkUserId,
            ExpiresAt = now.Add(LoginLifetime),
        });
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(new StartResponse(authorizationUrl));
    }

    /// <summary>
    /// Finishes a started login: 200 with a session for sign-ins, 204 for links. The started login is
    /// spent before the provider is asked, so a replayed callback finds nothing.
    /// </summary>
    private static async Task<IResult> Callback(
        CallbackRequest request,
        OidcSettings settings,
        OidcProvider provider,
        IdentityDbContext database,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        if (!settings.Enabled) return NotConfigured();
        DateTime now = timeProvider.GetUtcNow().UtcDateTime;
        string stateHash = TokenFactory.Hash(request.State ?? "");
        OidcLogin? login = await database.OidcLogins.SingleOrDefaultAsync(x => x.StateHash == stateHash, cancellationToken);
        if (login is null) return Expired();
        database.OidcLogins.Remove(login);
        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Expired();
        }
        if (DateTime.SpecifyKind(login.ExpiresAt, DateTimeKind.Utc) <= now) return Expired();

        OidcIdentity? person;
        try
        {
            person = await provider.RedeemAsync(request.Code ?? "", login.CodeVerifier, login.RedirectUri, login.Nonce, cancellationToken);
        }
        catch (OidcProviderUnavailableException)
        {
            return Unavailable(settings);
        }
        if (person is null) return HttpResults.Problem(401, "Login failed", $"{settings.Name} did not confirm the login");

        User? owner = await database.Users.SingleOrDefaultAsync(
            x => x.OidcIssuer == person.Issuer && x.OidcSubject == person.Subject, cancellationToken);
        if (login.LinkUserId is { } linkUserId)
            return await Link(linkUserId, owner, person, settings, database, cancellationToken);
        if (owner is null) return await RegisterPending(person, settings, database, cancellationToken);
        if (owner.Status != UserStatuses.Active) return HttpResults.Problem(403, "User inactive", "User is not active");
        return Results.Ok(await IdentitySessions.StartAsync(database, owner.Id, now, cancellationToken));
    }

    private static async Task<IResult> Link(
        Guid userId,
        User? owner,
        OidcIdentity person,
        OidcSettings settings,
        IdentityDbContext database,
        CancellationToken cancellationToken)
    {
        if (owner is not null && owner.Id != userId)
            return HttpResults.Problem(409, "Already linked", $"This {settings.Name} account is already linked to another user");
        User user = await database.Users.SingleAsync(x => x.Id == userId, cancellationToken);
        user.OidcIssuer = person.Issuer;
        user.OidcSubject = person.Subject;
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    /// <summary>
    /// An unknown provider user gets a pending account, like a password registration. It never takes
    /// over an existing account with the same name or email: that one has to sign in and link.
    /// </summary>
    private static async Task<IResult> RegisterPending(
        OidcIdentity person,
        OidcSettings settings,
        IdentityDbContext database,
        CancellationToken cancellationToken)
    {
        string email = person.Email?.Trim().ToLowerInvariant() ?? "";
        string name = (person.PreferredUsername ?? email.Split('@')[0]).Trim().ToLowerInvariant();
        if (email.Length == 0 || name.Length == 0)
            return HttpResults.Problem(422, "Validation failed", $"{settings.Name} did not share an email address");

        IResult taken = HttpResults.Problem(409, "Account exists",
            $"An account with this name or email already exists. Sign in with your password and link {settings.Name} under Account.");
        if (await database.Users.AnyAsync(x => x.Name == name || x.Email == email, cancellationToken)) return taken;
        database.Users.Add(new User
        {
            Name = name,
            Email = email,
            Role = Roles.User,
            Status = UserStatuses.Pending,
            OidcIssuer = person.Issuer,
            OidcSubject = person.Subject,
        });
        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return taken;
        }
        return HttpResults.Problem(403, "User inactive", "Your account was created and waits for an administrator to activate it");
    }

    private static string NewSecret() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));

    private static IResult NotConfigured() => HttpResults.Problem(404, "Not configured", "OIDC login is not configured");

    private static IResult Expired() => HttpResults.Problem(400, "Login expired", "This login has expired or was already used. Start again.");

    private static IResult Unavailable(OidcSettings settings) =>
        HttpResults.Problem(502, "Provider unavailable", $"{settings.Name} could not be reached");

    private sealed record OidcOffer(bool Enabled, string? Name);

    private sealed record StartRequest(string? RedirectUri, bool Link);

    private sealed record StartResponse(string AuthorizationUrl);

    private sealed record CallbackRequest(string? Code, string? State);
}
