ALTER TABLE identity.users
    ADD COLUMN IF NOT EXISTS role varchar(32) NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_users_status ON identity.users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON identity.users(role);
