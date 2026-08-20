using System.Text.Json.Serialization;

namespace Household.Api.Features.Identity;

public sealed class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    [JsonIgnore] public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = Roles.User;
    public string Status { get; set; } = UserStatuses.Pending;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class AppModule
{
    public Guid Id { get; set; }
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public bool Enabled { get; set; }
    public bool Active { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class Session
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string AccessTokenHash { get; set; } = "";
    public string RefreshTokenHash { get; set; } = "";
    public DateTime AccessExpiresAt { get; set; }
    public DateTime RefreshExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public User User { get; set; } = null!;
}

public static class Roles
{
    public const string Admin = "admin";
    public const string User = "user";
}

public static class UserStatuses
{
    public const string Pending = "pending";
    public const string Active = "active";
    public const string Blocked = "blocked";
}

public sealed record CurrentUser(Guid Id, string Name, string Email, string Role, string Status);
public sealed record TokenPair(string AccessToken, string RefreshToken, DateTime AccessExpiresAt, DateTime RefreshExpiresAt);
