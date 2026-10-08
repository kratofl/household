using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Identity;

[DbContext(typeof(IdentityDbContext))]
[Migration("202610080001_AddOidcLogin")]
public sealed class IdentityOidcMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS oidc_issuer varchar(255);
        ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS oidc_subject varchar(255);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oidc ON identity.users(oidc_issuer, oidc_subject);

        CREATE TABLE IF NOT EXISTS identity.oidc_logins (
            id uuid PRIMARY KEY DEFAULT uuidv7(),
            state_hash varchar(64) NOT NULL UNIQUE,
            nonce varchar(64) NOT NULL,
            code_verifier varchar(128) NOT NULL,
            redirect_uri varchar(2048) NOT NULL,
            link_user_id uuid REFERENCES identity.users(id) ON DELETE CASCADE,
            expires_at timestamp NOT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TABLE IF EXISTS identity.oidc_logins;
        DROP INDEX IF EXISTS identity.idx_users_oidc;
        ALTER TABLE identity.users DROP COLUMN IF EXISTS oidc_subject;
        ALTER TABLE identity.users DROP COLUMN IF EXISTS oidc_issuer;
        """);
}
