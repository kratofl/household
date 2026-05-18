CREATE TABLE IF NOT EXISTS budget.planned_expenses (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    owner_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES budget.accounts(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES budget.categories(id) ON DELETE SET NULL,
    name varchar(255) NOT NULL,
    kind varchar(64) NOT NULL DEFAULT 'fixed_cost',
    cadence varchar(64) NOT NULL DEFAULT 'monthly',
    amount_cents bigint NOT NULL,
    due_day integer NOT NULL DEFAULT 1,
    due_month integer,
    include_in_limit boolean NOT NULL DEFAULT true,
    active boolean NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_planned_expenses_amount_positive CHECK (amount_cents > 0),
    CONSTRAINT chk_planned_expenses_due_day CHECK (due_day BETWEEN 1 AND 31),
    CONSTRAINT chk_planned_expenses_due_month CHECK (due_month IS NULL OR due_month BETWEEN 1 AND 12)
);

ALTER TABLE budget.transactions
    ADD COLUMN IF NOT EXISTS planned_expense_id UUID REFERENCES budget.planned_expenses(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS budget.planned_expense_applications (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    owner_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    planned_expense_id UUID NOT NULL REFERENCES budget.planned_expenses(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES budget.periods(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES budget.transactions(id) ON DELETE CASCADE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (planned_expense_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_planned_expenses_owner ON budget.planned_expenses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_budget_planned_applications_owner_period ON budget.planned_expense_applications(owner_user_id, period_id);
