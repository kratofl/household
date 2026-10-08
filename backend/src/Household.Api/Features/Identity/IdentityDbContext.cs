using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Identity;

public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => this.Set<User>();
    public DbSet<AppModule> Modules => this.Set<AppModule>();
    public DbSet<Session> Sessions => this.Set<Session>();
    public DbSet<OidcLogin> OidcLogins => this.Set<OidcLogin>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("identity");
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(255);
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(255);
            entity.Property(x => x.PasswordHash).HasColumnName("password_hash").HasMaxLength(255);
            entity.Property(x => x.Role).HasColumnName("role").HasMaxLength(32);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(32);
            entity.Property(x => x.Theme).HasColumnName("theme").HasMaxLength(32);
            entity.Property(x => x.OidcIssuer).HasColumnName("oidc_issuer").HasMaxLength(255);
            entity.Property(x => x.OidcSubject).HasColumnName("oidc_subject").HasMaxLength(255);
            entity.Ignore(x => x.OidcLinked);
            entity.HasIndex(x => new { x.OidcIssuer, x.OidcSubject }).IsUnique();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(x => x.Name).IsUnique();
            entity.HasIndex(x => x.Email).IsUnique();
        });
        modelBuilder.Entity<AppModule>(entity =>
        {
            entity.ToTable("modules");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
            entity.Property(x => x.Key).HasColumnName("key").HasMaxLength(255);
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(255);
            entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(1024);
            entity.Property(x => x.Enabled).HasColumnName("enabled");
            entity.Property(x => x.Active).HasColumnName("active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(x => x.Key).IsUnique();
        });
        modelBuilder.Entity<OidcLogin>(entity =>
        {
            entity.ToTable("oidc_logins");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
            entity.Property(x => x.StateHash).HasColumnName("state_hash").HasMaxLength(64);
            entity.Property(x => x.Nonce).HasColumnName("nonce").HasMaxLength(64);
            entity.Property(x => x.CodeVerifier).HasColumnName("code_verifier").HasMaxLength(128);
            entity.Property(x => x.RedirectUri).HasColumnName("redirect_uri").HasMaxLength(2048);
            entity.Property(x => x.LinkUserId).HasColumnName("link_user_id");
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at").HasColumnType("timestamp without time zone");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(x => x.StateHash).IsUnique();
        });
        modelBuilder.Entity<Session>(entity =>
        {
            entity.ToTable("sessions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.AccessTokenHash).HasColumnName("access_token_hash").HasMaxLength(64);
            entity.Property(x => x.RefreshTokenHash).HasColumnName("refresh_token_hash").HasMaxLength(64);
            entity.Property(x => x.AccessExpiresAt).HasColumnName("access_expires_at").HasColumnType("timestamp without time zone");
            entity.Property(x => x.RefreshExpiresAt).HasColumnName("refresh_expires_at").HasColumnType("timestamp without time zone");
            entity.Property(x => x.RevokedAt).HasColumnName("revoked_at").HasColumnType("timestamp without time zone");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(x => x.AccessTokenHash).IsUnique();
            entity.HasIndex(x => x.RefreshTokenHash).IsUnique();
            entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
