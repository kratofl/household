using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

public static class MerchantEndpoints
{
    public static void MapMerchantEndpoints(this IEndpointRouteBuilder budget)
    {
        Microsoft.AspNetCore.Routing.RouteGroupBuilder group = budget.MapGroup("/merchants");
        group.MapGet("/", List);
        group.MapPost("/", Create);
        group.MapPatch("/{id:guid}", Update);
    }

    /// The published merchants plus whatever the user added, as one list the picker shows directly.
    private static async Task<IResult> List(HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        List<MerchantRow> rows = await database.Merchants
            .Where(row => row.OwnerUserId == null || row.OwnerUserId == user.Id)
            .OrderBy(row => row.Name)
            .ToListAsync(cancellationToken);
        return Results.Ok(rows.Select(View).ToList());
    }

    private static async Task<IResult> Create(SaveMerchant request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        if (request.Global && user.Role != Roles.Admin) return Forbidden();
        if (Name(request) is not string name) return Invalid();

        Guid? owner = request.Global ? null : user.Id;
        if (await Taken(database, user, name, null, cancellationToken)) return Conflict();

        MerchantRow row = new() { Id = Guid.CreateVersion7(), OwnerUserId = owner, Name = name };
        database.Merchants.Add(row);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(View(row));
    }

    /// Renames or archives. A published merchant belongs to everyone, so only an admin may
    /// touch it; an own merchant only its owner. Anything else is not the caller's to see.
    private static async Task<IResult> Update(Guid id, SaveMerchant request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        CurrentUser? user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Results.Unauthorized();
        MerchantRow? row = await database.Merchants.SingleOrDefaultAsync(
            candidate => candidate.Id == id && (candidate.OwnerUserId == null || candidate.OwnerUserId == user.Id), cancellationToken);
        if (row is null) return Results.NotFound();
        if (row.OwnerUserId is null && user.Role != Roles.Admin) return Forbidden();
        if (Name(request) is not string name) return Invalid();
        if (await Taken(database, user, name, row.Id, cancellationToken)) return Conflict();

        row.Name = name;
        row.Archived = request.Archived;
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(View(row));
    }

    private static string? Name(SaveMerchant request)
    {
        string name = request.Name?.Trim() ?? "";
        return name.Length is 0 or > 120 ? null : name;
    }

    /// Published merchants count as taken too, otherwise a user ends up with two REWE cards.
    private static Task<bool> Taken(BudgetDbContext database, CurrentUser user, string name, Guid? except, CancellationToken cancellationToken) =>
        database.Merchants.AnyAsync(row => row.Id != except
            && (row.OwnerUserId == null || row.OwnerUserId == user.Id)
            && row.Name.ToLower() == name.ToLower(), cancellationToken);

    private static IResult Invalid() => HttpResults.Problem(422, "Validation failed", "invalid_input");
    private static IResult Conflict() => HttpResults.Problem(409, "Budget conflict", "merchant_exists");
    private static IResult Forbidden() => HttpResults.Problem(403, "Forbidden", "Admin role required");

    private static MerchantView View(MerchantRow row) =>
        new(row.Id, row.Name, row.LogoKey, row.Color, row.OwnerUserId is null, row.Archived);
}
