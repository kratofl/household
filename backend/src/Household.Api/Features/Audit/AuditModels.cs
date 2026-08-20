using System.Text.Json.Serialization;

namespace Household.Api.Features.Audit;

public sealed class AuditEvent
{
    public Guid Id { get; set; }
    public DateTime OccurredAt { get; set; }
    public Guid? ActorUserId { get; set; }
    public string ActorRole { get; set; } = "";
    public string Action { get; set; } = "";
    public string Module { get; set; } = "";
    public string TargetType { get; set; } = "";
    public string TargetId { get; set; } = "";
    public string Outcome { get; set; } = "";
    public string RequestId { get; set; } = "";
    public string Ip { get; set; } = "";
    public string UserAgent { get; set; } = "";
    [JsonIgnore] public string MetadataJson { get; set; } = "{}";
    [JsonIgnore] public string? BeforeJson { get; set; }
    [JsonIgnore] public string? AfterJson { get; set; }
    public string ErrorCode { get; set; } = "";
}

public sealed record AuditEventResponse(
    Guid Id,
    DateTime OccurredAt,
    Guid? ActorUserId,
    string ActorRole,
    string Action,
    string Module,
    string TargetType,
    string TargetId,
    string Outcome,
    string RequestId,
    string Ip,
    string UserAgent,
    object Metadata,
    object? Before,
    object? After,
    string ErrorCode);
