using System.Text.Json;
using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Audit;

public static class AuditEndpoints
{
    public static IEndpointRouteBuilder MapAuditEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/audit/events", ListEvents);
        return routes;
    }

    private static async Task<IResult> ListEvents(
        int? limit,
        HttpContext context,
        IIdentityAccess identity,
        AuditDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
        if (user.Role != Roles.Admin) return HttpResults.Problem(403, "Forbidden", "Admin role required");
        var take = limit ?? 100;
        if (take is < 1 or > 500) return HttpResults.Problem(400, "Invalid limit", "Limit must be between 1 and 500");
        var events = await database.Events.AsNoTracking().OrderByDescending(x => x.OccurredAt).Take(take).ToListAsync(cancellationToken);
        return Results.Ok(events.Select(ToResponse));
    }

    private static AuditEventResponse ToResponse(AuditEvent item) => new(
        item.Id, item.OccurredAt, item.ActorUserId, item.ActorRole, item.Action, item.Module,
        item.TargetType, item.TargetId, item.Outcome, item.RequestId, item.Ip, item.UserAgent,
        JsonSerializer.Deserialize<JsonElement>(item.MetadataJson),
        item.BeforeJson is null ? null : JsonSerializer.Deserialize<JsonElement>(item.BeforeJson),
        item.AfterJson is null ? null : JsonSerializer.Deserialize<JsonElement>(item.AfterJson),
        item.ErrorCode);
}
