using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Identity;

public interface IIdentityAccess
{
    Task<CurrentUser?> CurrentUserAsync(HttpContext context, CancellationToken cancellationToken = default);
}

public sealed class IdentityAccess(IdentityDbContext database, TimeProvider timeProvider) : IIdentityAccess
{
    public async Task<CurrentUser?> CurrentUserAsync(HttpContext context, CancellationToken cancellationToken = default)
    {
        var authorization = context.Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith("Bearer ", StringComparison.Ordinal) || authorization.Length == 7) return null;
        var hash = TokenFactory.Hash(authorization[7..]);
        var session = await database.Sessions.AsNoTracking().Include(x => x.User)
            .SingleOrDefaultAsync(x => x.AccessTokenHash == hash && x.RevokedAt == null, cancellationToken);
        if (session is null || session.User.Status != UserStatuses.Active ||
            AsUtc(session.AccessExpiresAt) <= timeProvider.GetUtcNow().UtcDateTime)
        {
            return null;
        }

        return new CurrentUser(session.User.Id, session.User.Name, session.User.Email, session.User.Role, session.User.Status);
    }

    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
}

public static class TokenFactory
{
    public static TokenPair Create(DateTime now)
    {
        return new TokenPair(Random(), Random(), now.AddMinutes(15), now.AddDays(30));
    }

    public static string Hash(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static string Random() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
