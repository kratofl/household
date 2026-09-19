using System.Text.Json;
using Household.Api.Features.Identity;

namespace Household.Api.Features.Audit;

public sealed class AuditWriter(AuditDbContext database)
{
    public async Task RecordAsync(
        HttpContext context,
        CurrentUser? user,
        string action,
        string module,
        string targetType,
        string outcome,
        object? metadata,
        CancellationToken cancellationToken,
        string errorCode = "")
    {
        database.Events.Add(new AuditEvent
        {
            ActorUserId = user?.Id,
            ActorRole = user?.Role ?? "",
            Action = action,
            Module = module,
            TargetType = targetType,
            Outcome = outcome,
            RequestId = context.TraceIdentifier,
            Ip = context.Connection.RemoteIpAddress?.ToString() ?? "",
            UserAgent = context.Request.Headers.UserAgent.ToString(),
            MetadataJson = JsonSerializer.Serialize(metadata ?? new { }),
            ErrorCode = errorCode,
        });
        await database.SaveChangesAsync(cancellationToken);
    }
}
