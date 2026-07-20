using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Audit;

public sealed class AuditDbContext(DbContextOptions<AuditDbContext> options) : DbContext(options)
{
    public DbSet<AuditEvent> Events => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("audit");
        modelBuilder.Entity<AuditEvent>(entity =>
        {
            entity.ToTable("events");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("uuidv7()");
            entity.Property(x => x.OccurredAt).HasColumnName("occurred_at").HasColumnType("timestamp without time zone").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(x => x.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(x => x.ActorRole).HasColumnName("actor_role");
            entity.Property(x => x.Action).HasColumnName("action");
            entity.Property(x => x.Module).HasColumnName("module");
            entity.Property(x => x.TargetType).HasColumnName("target_type");
            entity.Property(x => x.TargetId).HasColumnName("target_id");
            entity.Property(x => x.Outcome).HasColumnName("outcome");
            entity.Property(x => x.RequestId).HasColumnName("request_id");
            entity.Property(x => x.Ip).HasColumnName("ip");
            entity.Property(x => x.UserAgent).HasColumnName("user_agent");
            entity.Property(x => x.MetadataJson).HasColumnName("metadata").HasColumnType("jsonb");
            entity.Property(x => x.BeforeJson).HasColumnName("before").HasColumnType("jsonb");
            entity.Property(x => x.AfterJson).HasColumnName("after").HasColumnType("jsonb");
            entity.Property(x => x.ErrorCode).HasColumnName("error_code");
        });
    }
}
