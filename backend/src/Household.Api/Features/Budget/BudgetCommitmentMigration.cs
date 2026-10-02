using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

[DbContext(typeof(BudgetDbContext))]
[Migration("202607230010_RecurringCommitments")]
public sealed class BudgetCommitmentMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS budget.commitment_plans (
            id uuid PRIMARY KEY DEFAULT uuidv7(), series_id uuid NOT NULL, owner_user_id uuid NOT NULL,
            category_id uuid REFERENCES budget.categories(id) ON DELETE RESTRICT,
            kind varchar(32) NOT NULL CHECK (kind IN ('fixed_cost', 'subscription')),
            name varchar(255) NOT NULL, amount_cents bigint NOT NULL CHECK (amount_cents > 0),
            cadence varchar(32) NOT NULL, interval_unit varchar(16) NOT NULL,
            interval_count integer NOT NULL CHECK (interval_count > 0), weekdays varchar(32) NOT NULL DEFAULT '',
            start_date date NOT NULL, effective_from date NOT NULL, effective_to date,
            budgeting_mode varchar(32) NOT NULL CHECK (budgeting_mode IN ('due_period', 'gradual_reservation')),
            automatic_posting boolean NOT NULL DEFAULT false, change_reason varchar(1024) NOT NULL DEFAULT '',
            active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_commitment_plans_series
            ON budget.commitment_plans(owner_user_id, series_id, effective_from);
        CREATE TABLE IF NOT EXISTS budget.commitment_pauses (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, series_id uuid NOT NULL,
            pause_from date NOT NULL, pause_through date NOT NULL, reason varchar(1024) NOT NULL DEFAULT '',
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK (pause_through >= pause_from));
        CREATE INDEX IF NOT EXISTS idx_budget_commitment_pauses_series
            ON budget.commitment_pauses(owner_user_id, series_id, pause_from);
        CREATE TABLE IF NOT EXISTS budget.commitment_stops (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, series_id uuid NOT NULL,
            effective_on date NOT NULL, reason varchar(1024) NOT NULL DEFAULT '',
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_commitment_stops_series
            ON budget.commitment_stops(owner_user_id, series_id, effective_on);
        CREATE TABLE IF NOT EXISTS budget.commitment_occurrence_overrides (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, series_id uuid NOT NULL,
            scheduled_on date NOT NULL, occurred_on date NOT NULL, name varchar(255) NOT NULL,
            amount_cents bigint NOT NULL CHECK (amount_cents > 0), reason varchar(1024) NOT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS idx_budget_commitment_overrides_occurrence
            ON budget.commitment_occurrence_overrides(owner_user_id, series_id, scheduled_on, created_at);
        CREATE TABLE IF NOT EXISTS budget.commitment_postings (
            id uuid PRIMARY KEY DEFAULT uuidv7(), owner_user_id uuid NOT NULL, series_id uuid NOT NULL,
            version_id uuid NOT NULL REFERENCES budget.commitment_plans(id) ON DELETE RESTRICT,
            scheduled_on date NOT NULL, expected_on date NOT NULL, actual_on date NOT NULL,
            expected_amount_cents bigint NOT NULL CHECK (expected_amount_cents > 0),
            actual_amount_cents bigint NOT NULL CHECK (actual_amount_cents > 0),
            posting_mode varchar(16) NOT NULL CHECK (posting_mode IN ('manual', 'automatic', 'matched', 'legacy')),
            ledger_entry_id uuid NOT NULL REFERENCES budget.ledger_entries(id) ON DELETE RESTRICT,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, series_id, scheduled_on));

        INSERT INTO budget.commitment_plans (
            id, series_id, owner_user_id, category_id, kind, name, amount_cents, cadence,
            interval_unit, interval_count, start_date, effective_from, budgeting_mode,
            automatic_posting, change_reason, active, created_at, updated_at)
        SELECT p.id, p.id, p.owner_user_id, p.category_id, p.kind, p.name, p.amount_cents, p.cadence,
            CASE WHEN p.cadence = 'yearly' THEN 'year' ELSE 'month' END, 1,
            CASE WHEN p.cadence = 'yearly' THEN
                (make_date(EXTRACT(YEAR FROM p.created_at)::integer, COALESCE(p.due_month, 1), 1)
                    + (LEAST(p.due_day, EXTRACT(DAY FROM (date_trunc('month', make_date(EXTRACT(YEAR FROM p.created_at)::integer, COALESCE(p.due_month, 1), 1)) + interval '1 month - 1 day'))::integer) - 1))::date
            ELSE
                (date_trunc('month', p.created_at)
                    + (LEAST(p.due_day, EXTRACT(DAY FROM (date_trunc('month', p.created_at) + interval '1 month - 1 day'))::integer) - 1) * interval '1 day')::date
            END,
            p.created_at::date, 'due_period', false, 'Migrated from legacy planned expense', p.active,
            p.created_at, p.updated_at
        FROM budget.planned_expenses p
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO budget.commitment_postings (
            owner_user_id, series_id, version_id, scheduled_on, expected_on, actual_on,
            expected_amount_cents, actual_amount_cents, posting_mode, ledger_entry_id, created_at)
        SELECT a.owner_user_id, a.planned_expense_id, a.planned_expense_id, t.occurred_on, t.occurred_on,
            t.occurred_on, p.amount_cents, t.amount_cents, 'legacy', l.id, a.applied_at
        FROM budget.planned_expense_applications a
        JOIN budget.planned_expenses p ON p.id = a.planned_expense_id
        JOIN budget.transactions t ON t.id = a.transaction_id
        JOIN budget.ledger_entries l ON l.legacy_transaction_id = t.id
        ON CONFLICT (owner_user_id, series_id, scheduled_on) DO NOTHING;
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
