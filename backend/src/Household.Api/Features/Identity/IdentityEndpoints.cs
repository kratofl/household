using Household.Api.Features.Audit;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Identity;

public static class IdentityEndpoints
{
    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder routes)
    {
        RouteGroupBuilder auth = routes.MapGroup("/auth");
        auth.MapPost("/authorize", Authorize);
        auth.MapPost("/refresh", Refresh);
        auth.MapPost("/logout", Logout);
        auth.MapOidcEndpoints();

        RouteGroupBuilder users = routes.MapGroup("/users");
        users.MapGet("/", ListUsers);
        users.MapPut("/", CreateUser);
        users.MapPatch("/{id:guid}", UpdateUser);
        users.MapGet("/me", Me);
        users.MapPatch("/me", UpdateMe);
        users.MapPut("/me/password", ChangePassword);
        users.MapDelete("/me/oidc", UnlinkOidc);

        RouteGroupBuilder modules = routes.MapGroup("/modules");
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
        string username = request.Username?.Trim().ToLowerInvariant() ?? "";
        User? user = await database.Users.SingleOrDefaultAsync(x => x.Name == username, cancellationToken);
        if (user is null || !PasswordMatches(user, request.Password))
            return HttpResults.Problem(401, "Invalid login", "Username or password incorrect");
        if (user.Status != UserStatuses.Active)
            return HttpResults.Problem(403, "User inactive", "User is not active");

        return Results.Ok(await IdentitySessions.StartAsync(database, user.Id, timeProvider.GetUtcNow().UtcDateTime, cancellationToken));
    }

    private static async Task<IResult> Refresh(
        RefreshRequest request,
        IdentityDbContext database,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        string hash = TokenFactory.Hash(request.RefreshToken ?? "");
        Session? session = await database.Sessions.Include(x => x.User)
            .SingleOrDefaultAsync(x => x.RefreshTokenHash == hash && x.RevokedAt == null, cancellationToken);
        DateTime now = timeProvider.GetUtcNow().UtcDateTime;
        if (session is null || session.User.Status != UserStatuses.Active || AsUtc(session.RefreshExpiresAt) <= now)
            return HttpResults.Problem(401, "Unauthorized", "Invalid refresh token");

        TokenPair pair = TokenFactory.Create(now);
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
        string hash = TokenFactory.Hash(request.RefreshToken ?? "");
        Session? session = await database.Sessions.SingleOrDefaultAsync(
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
        CurrentUser? admin = await identity.CurrentUserAsync(context, cancellationToken);
        if (admin is null) return Unauthorized();
        if (admin.Role != Roles.Admin) return Forbidden();
        return Results.Ok(await database.Users.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken));
    }

    /// <summary>
    /// Lets an admin activate a registration, block or restore an account, and grant or take the admin
    /// role. Admins cannot change their own account, so the household never loses its last admin.
    /// </summary>
    private static async Task<IResult> UpdateUser(
        Guid id,
        UpdateUserRequest request,
        HttpContext context,
        IIdentityAccess identity,
        IdentityDbContext database,
        AuditWriter audit,
        CancellationToken cancellationToken)
    {
        CurrentUser? admin = await identity.CurrentUserAsync(context, cancellationToken);
        if (admin is null) return Unauthorized();
        if (admin.Role != Roles.Admin) return Forbidden();
        if (request.Status is not (null or UserStatuses.Active or UserStatuses.Blocked) ||
            request.Role is not (null or Roles.Admin or Roles.User))
            return HttpResults.Problem(422, "Validation failed", "Status must be active or blocked, role admin or user");
        if (id == admin.Id)
            return HttpResults.Problem(409, "Own account", "Admins cannot change their own status or role");

        User? user = await database.Users.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null) return HttpResults.Problem(404, "Not found", "User not found");
        user.Status = request.Status ?? user.Status;
        user.Role = request.Role ?? user.Role;
        await database.SaveChangesAsync(cancellationToken);
        await audit.RecordAsync(context, admin, "update_user", "identity", "user", "success", new
        {
            userId = user.Id,
            status = user.Status,
            role = user.Role,
        }, cancellationToken);
        return Results.Ok(user);
    }

    private static async Task<IResult> CreateUser(
        CreateUserRequest request,
        IdentityDbContext database,
        CancellationToken cancellationToken)
    {
        string name = request.Name?.Trim().ToLowerInvariant() ?? "";
        string email = request.Email?.Trim().ToLowerInvariant() ?? "";
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
        CurrentUser? current = await identity.CurrentUserAsync(context, cancellationToken);
        if (current is null) return Unauthorized();
        User user = await database.Users.AsNoTracking().SingleAsync(x => x.Id == current.Id, cancellationToken);
        return Results.Ok(user);
    }

    /// <summary>Updates profile preferences of the current user. Only the accent theme so far.</summary>
    private static async Task<IResult> UpdateMe(
        UpdateMeRequest request,
        HttpContext context,
        IIdentityAccess identity,
        IdentityDbContext database,
        CancellationToken cancellationToken)
    {
        CurrentUser? current = await identity.CurrentUserAsync(context, cancellationToken);
        if (current is null) return Unauthorized();
        if (request.Theme is null || !Themes.All.Contains(request.Theme))
            return HttpResults.Problem(422, "Validation failed", "Unknown theme");
        User user = await database.Users.SingleAsync(x => x.Id == current.Id, cancellationToken);
        user.Theme = request.Theme;
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(user);
    }

    private static async Task<IResult> ChangePassword(
        ChangePasswordRequest request,
        HttpContext context,
        IIdentityAccess identity,
        IdentityDbContext database,
        CancellationToken cancellationToken)
    {
        CurrentUser? current = await identity.CurrentUserAsync(context, cancellationToken);
        if (current is null) return Unauthorized();
        if (string.IsNullOrEmpty(request.NewPassword))
            return HttpResults.Problem(422, "Validation failed", "New password is required");
        User user = await database.Users.SingleAsync(x => x.Id == current.Id, cancellationToken);
        if (!PasswordMatches(user, request.CurrentPassword))
            return HttpResults.Problem(403, "Invalid password", "Current password is incorrect");
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, 14);
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    /// <summary>
    /// Detaches the provider account from the current user. Refused while it is the only way in:
    /// an account created through the provider has no password to fall back on.
    /// </summary>
    private static async Task<IResult> UnlinkOidc(
        HttpContext context,
        IIdentityAccess identity,
        IdentityDbContext database,
        CancellationToken cancellationToken)
    {
        CurrentUser? current = await identity.CurrentUserAsync(context, cancellationToken);
        if (current is null) return Unauthorized();
        User user = await database.Users.SingleAsync(x => x.Id == current.Id, cancellationToken);
        if (user.PasswordHash.Length == 0)
            return HttpResults.Problem(409, "Only sign-in method", "This account has no password, so the provider is its only way in");
        user.OidcIssuer = null;
        user.OidcSubject = null;
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    /// <summary>Accounts created through the OIDC provider have no password hash; nothing matches it.</summary>
    private static bool PasswordMatches(User user, string? password) =>
        user.PasswordHash.Length > 0 && BCrypt.Net.BCrypt.Verify(password ?? "", user.PasswordHash);

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
        CurrentUser? admin = await identity.CurrentUserAsync(context, cancellationToken);
        if (admin is null) return Unauthorized();
        if (admin.Role != Roles.Admin) return Forbidden();
        if (request.ModuleIds is null)
            return HttpResults.Problem(400, "Invalid module id", "A module id could not be parsed");

        List<AppModule> modules = await database.Modules.Where(x => x.Enabled).ToListAsync(cancellationToken);
        HashSet<Guid> selected = request.ModuleIds.ToHashSet();
        foreach (AppModule? module in modules) module.Active = selected.Contains(module.Id);
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
    private sealed record UpdateUserRequest(string? Status, string? Role);
    private sealed record CreateUserRequest(string? Name, string? Email, string? Password);
    private sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);
    private sealed record UpdateMeRequest(string? Theme);
    private sealed record SetActiveModulesRequest(IReadOnlyList<Guid>? ModuleIds);
}
