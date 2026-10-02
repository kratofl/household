using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Identity;

[DbContext(typeof(IdentityDbContext))]
[Migration("202607200001_AdoptLegacyIdentity")]
public sealed class IdentityMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS identity.users (
            id uuid PRIMARY KEY DEFAULT uuidv7(), name varchar(255) NOT NULL UNIQUE, email varchar(255) NOT NULL UNIQUE,
            password_hash varchar(255) NOT NULL, role varchar(32) NOT NULL DEFAULT 'user', status varchar(32) NOT NULL DEFAULT 'pending',
            created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP);
        ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS role varchar(32) NOT NULL DEFAULT 'user';
        ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'pending';
        CREATE INDEX IF NOT EXISTS idx_users_status ON identity.users(status);
        CREATE INDEX IF NOT EXISTS idx_users_role ON identity.users(role);

        CREATE TABLE IF NOT EXISTS identity.modules (
            id uuid PRIMARY KEY DEFAULT uuidv7(), key varchar(255) NOT NULL UNIQUE, name varchar(255) NOT NULL,
            description varchar(1024) NOT NULL DEFAULT '', enabled boolean NOT NULL DEFAULT true, active boolean NOT NULL DEFAULT false,
            created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP);
        INSERT INTO identity.modules (key, name, description, enabled, active) VALUES
            ('budget', 'Budget', 'Track expenses, categories, limits, accounts, and savings plans.', true, true),
            ('shopping', 'Shopping List', 'Plan and share shopping lists.', false, false),
            ('recipes', 'Recipes', 'Manage household recipes.', false, false),
            ('meal_plan', 'Meal Plan', 'Plan meals across the household calendar.', false, false),
            ('calendar', 'Calendar', 'Coordinate household events and schedules.', false, false),
            ('waste_schedule', 'Waste Schedule', 'Track waste collection dates.', false, false)
        ON CONFLICT (key) DO NOTHING;

        CREATE TABLE IF NOT EXISTS identity.sessions (
            id uuid PRIMARY KEY DEFAULT uuidv7(), user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
            access_token_hash varchar(64) NOT NULL UNIQUE, refresh_token_hash varchar(64) NOT NULL UNIQUE,
            access_expires_at timestamp NOT NULL, refresh_expires_at timestamp NOT NULL, revoked_at timestamp,
            created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_sessions_access_token_hash ON identity.sessions(access_token_hash);
        CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash ON identity.sessions(refresh_token_hash);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON identity.sessions(user_id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
