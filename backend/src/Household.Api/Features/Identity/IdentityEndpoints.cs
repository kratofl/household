using Household.Api.Features.Audit;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Identity;

public static class IdentityEndpoints
{
    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder routes)
    {
        var auth = routes.MapGroup("/auth");
        auth.MapPost("/authorize", Authorize);
        auth.MapPost("/refresh", Refresh);
        auth.MapPost("/logout", Logout);

        var users = routes.MapGroup("/users");
        users.MapGet("/", ListUsers);
        users.MapPut("/", CreateUser);
        users.MapGet("/me", Me);
        users.MapPut("/me/password", ChangePassword);

        var modules = routes.MapGroup("/modules");
        modules.MapGet("/", ListModules);
        modules.MapPatch("/active", SetActiveModules);
        routes.MapGet("/identity/healthz", () => Results.NoContent());
        return routes;
    }

    private static async Task<IResult> Authorize(
        AuthorizeRequest request,
        IdentityDbContext database,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var username = request.Username?.Trim().ToLowerInvariant() ?? "";
        var user = await database.Users.SingleOrDefaultAsync(x => x.Name == username, cancellationToken);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password ?? "", user.PasswordHash))
            return HttpResults.Problem(401, "Invalid login", "Username or password incorrect");
        if (user.Status != UserStatuses.Active)
            return HttpResults.Problem(403, "User inactive", "User is not active");

        var pair = TokenFactory.Create(timeProvider.GetUtcNow().UtcDateTime);
        database.Sessions.Add(new Session
        {
            UserId = user.Id,
            AccessTokenHash = TokenFactory.Hash(pair.AccessToken),
            RefreshTokenHash = TokenFactory.Hash(pair.RefreshToken),
            AccessExpiresAt = DateTime.SpecifyKind(pair.AccessExpiresAt, DateTimeKind.Unspecified),
            RefreshExpiresAt = DateTime.SpecifyKind(pair.RefreshExpiresAt, DateTimeKind.Unspecified),
        });
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(pair);
    }

    private static async Task<IResult> Refresh(
        RefreshRequest request,
        IdentityDbContext database,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var hash = TokenFactory.Hash(request.RefreshToken ?? "");
        var session = await database.Sessions.Include(x => x.User)
            .SingleOrDefaultAsync(x => x.RefreshTokenHash == hash && x.RevokedAt == null, cancellationToken);
        var now = timeProvider.GetUtcNow().UtcDateTime;
        if (session is null || session.User.Status != UserStatuses.Active || AsUtc(session.RefreshExpiresAt) <= now)
            return HttpResults.Problem(401, "Unauthorized", "Invalid refresh token");

        var pair = TokenFactory.Create(now);
        session.AccessTokenHash = TokenFactory.Hash(pair.AccessToken);
        session.RefreshTokenHash = TokenFactory.Hash(pair.RefreshToken);
        session.AccessExpiresAt = DateTime.SpecifyKind(pair.AccessExpiresAt, DateTimeKind.Unspecified);
        session.RefreshExpiresAt = DateTime.SpecifyKind(pair.RefreshExpiresAt, DateTimeKind.Unspecified);
        session.RevokedAt = null;
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(pair);
    }

    private static async Task<IResult> Logout(
        LogoutRequest request,
        IdentityDbContext database,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var hash = TokenFactory.Hash(request.RefreshToken ?? "");
        var session = await database.Sessions.SingleOrDefaultAsync(
            x => x.RefreshTokenHash == hash && x.RevokedAt == null, cancellationToken);
        if (session is not null)
        {
            session.RevokedAt = DateTime.SpecifyKind(timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Unspecified);
            await database.SaveChangesAsync(cancellationToken);
        }

        return Results.NoContent();
    }

    private static async Task<IResult> ListUsers(
        HttpContext context,
        IIdentityAccess identity,
        IdentityDbContext database,
        CancellationToken cancellationToken)
    {
        var admin = await identity.CurrentUserAsync(context, cancellationToken);
        if (admin is null) return Unauthorized();
        if (admin.Role != Roles.Admin) return Forbidden();
        return Results.Ok(await database.Users.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken));
    }

    private static async Task<IResult> CreateUser(
        CreateUserRequest request,
        IdentityDbContext database,
        CancellationToken cancellationToken)
    {
        var name = request.Name?.Trim().ToLowerInvariant() ?? "";
        var email = request.Email?.Trim().ToLowerInvariant() ?? "";
        if (name.Length == 0 || email.Length == 0 || string.IsNullOrEmpty(request.Password))
            return HttpResults.Problem(422, "Validation failed", "Name, email and password are required");
        database.Users.Add(new User
        {
            Name = name,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, 14),
            Role = Roles.User,
            Status = UserStatuses.Pending,
        });
        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return HttpResults.Problem(400, "Invalid user", "User could not be created");
        }
        return Results.StatusCode(201);
    }

    private static async Task<IResult> Me(
        HttpContext context,
        IIdentityAccess identity,
        IdentityDbContext database,
        CancellationToken cancellationToken)
    {
        var current = await identity.CurrentUserAsync(context, cancellationToken);
        if (current is null) return Unauthorized();
        var user = await database.Users.AsNoTracking().SingleAsync(x => x.Id == current.Id, cancellationToken);
        return Results.Ok(user);
    }

    private static async Task<IResult> ChangePassword(
        ChangePasswordRequest request,
        HttpContext context,
        IIdentityAccess identity,
        IdentityDbContext database,
        CancellationToken cancellationToken)
    {
        var current = await identity.CurrentUserAsync(context, cancellationToken);
        if (current is null) return Unauthorized();
        if (string.IsNullOrEmpty(request.NewPassword))
            return HttpResults.Problem(422, "Validation failed", "New password is required");
        var user = await database.Users.SingleAsync(x => x.Id == current.Id, cancellationToken);
        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword ?? "", user.PasswordHash))
            return HttpResults.Problem(403, "Invalid password", "Current password is incorrect");
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, 14);
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ListModules(IdentityDbContext database, CancellationToken cancellationToken) =>
        Results.Ok(await database.Modules.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken));

    private static async Task<IResult> SetActiveModules(
        SetActiveModulesRequest request,
        HttpContext context,
        IIdentityAccess identity,
        IdentityDbContext database,
        AuditWriter audit,
        CancellationToken cancellationToken)
    {
        var admin = await identity.CurrentUserAsync(context, cancellationToken);
        if (admin is null) return Unauthorized();
        if (admin.Role != Roles.Admin) return Forbidden();
        if (request.ModuleIds is null)
            return HttpResults.Problem(400, "Invalid module id", "A module id could not be parsed");

        var modules = await database.Modules.Where(x => x.Enabled).ToListAsync(cancellationToken);
        var selected = request.ModuleIds.ToHashSet();
        foreach (var module in modules) module.Active = selected.Contains(module.Id);
        await database.SaveChangesAsync(cancellationToken);
        await audit.RecordAsync(context, admin, "set_active_modules", "identity", "module", "success", new
        {
            moduleIds = request.ModuleIds,
            count = request.ModuleIds.Count,
        }, cancellationToken);
        return Results.NoContent();
    }

    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
    private static IResult Forbidden() => HttpResults.Problem(403, "Forbidden", "Admin role required");
    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private sealed record AuthorizeRequest(string? Username, string? Password);
    private sealed record RefreshRequest(string? RefreshToken);
    private sealed record LogoutRequest(string? RefreshToken);
    private sealed record CreateUserRequest(string? Name, string? Email, string? Password);
    private sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);
    private sealed record SetActiveModulesRequest(IReadOnlyList<Guid>? ModuleIds);
}
