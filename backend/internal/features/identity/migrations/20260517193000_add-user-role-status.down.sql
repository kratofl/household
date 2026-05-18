DROP INDEX IF EXISTS identity.idx_users_role;
DROP INDEX IF EXISTS identity.idx_users_status;

ALTER TABLE identity.users
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS role;
