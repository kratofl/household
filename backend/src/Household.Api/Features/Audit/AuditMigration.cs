using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Audit;

[DbContext(typeof(AuditDbContext))]
[Migration("202607200002_AdoptLegacyAudit")]
public sealed class AuditMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS audit.events (
            id uuid PRIMARY KEY DEFAULT uuidv7(), occurred_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            actor_user_id uuid, actor_role varchar(64) NOT NULL DEFAULT '', action varchar(128) NOT NULL,
            module varchar(64) NOT NULL, target_type varchar(128) NOT NULL DEFAULT '', target_id varchar(128) NOT NULL DEFAULT '',
            outcome varchar(32) NOT NULL, request_id varchar(128) NOT NULL DEFAULT '', ip varchar(128) NOT NULL DEFAULT '',
            user_agent varchar(512) NOT NULL DEFAULT '', metadata jsonb NOT NULL DEFAULT '{}', before jsonb, after jsonb,
            error_code varchar(128) NOT NULL DEFAULT '');
        CREATE INDEX IF NOT EXISTS audit_events_occurred_at_idx ON audit.events (occurred_at DESC);
        CREATE INDEX IF NOT EXISTS audit_events_actor_user_id_idx ON audit.events (actor_user_id);
        CREATE INDEX IF NOT EXISTS audit_events_module_action_idx ON audit.events (module, action);
        CREATE INDEX IF NOT EXISTS audit_events_outcome_idx ON audit.events (outcome);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
