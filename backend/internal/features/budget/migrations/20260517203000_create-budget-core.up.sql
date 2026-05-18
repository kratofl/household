CREATE TABLE IF NOT EXISTS budget.periods (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    owner_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    spending_limit_cents bigint NOT NULL DEFAULT 0,
    overspend_carryover_cents bigint NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (owner_user_id, start_date)
);

CREATE TABLE IF NOT EXISTS budget.categories (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    owner_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    color varchar(32) NOT NULL,
    behavior varchar(64) NOT NULL DEFAULT 'include_in_limit',
    protected boolean NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (owner_user_id, name)
);

CREATE TABLE IF NOT EXISTS budget.accounts (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    owner_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    balance_cents bigint NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (owner_user_id, name)
);

CREATE TABLE IF NOT EXISTS budget.transactions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    owner_user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES budget.periods(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES budget.accounts(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES budget.categories(id) ON DELETE SET NULL,
    occurred_on DATE NOT NULL,
    description varchar(512) NOT NULL,
    amount_cents bigint NOT NULL,
    include_in_limit boolean NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_budget_periods_owner ON budget.periods(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_owner ON budget.categories(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_budget_accounts_owner ON budget.accounts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_owner_period ON budget.transactions(owner_user_id, period_id);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_occurred_on ON budget.transactions(occurred_on);
