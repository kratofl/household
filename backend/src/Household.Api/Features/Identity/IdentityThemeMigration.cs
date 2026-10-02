using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Identity;

[DbContext(typeof(IdentityDbContext))]
[Migration("202609150001_AddUserTheme")]
public sealed class IdentityThemeMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS theme varchar(32) NOT NULL DEFAULT 'mandarine';
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE identity.users DROP COLUMN IF EXISTS theme;
        """);
}
