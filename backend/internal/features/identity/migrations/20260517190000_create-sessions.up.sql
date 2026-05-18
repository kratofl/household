CREATE TABLE IF NOT EXISTS identity.sessions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    access_token_hash varchar(64) NOT NULL UNIQUE,
    refresh_token_hash varchar(64) NOT NULL UNIQUE,
    access_expires_at TIMESTAMP NOT NULL,
    refresh_expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_access_token_hash ON identity.sessions(access_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash ON identity.sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON identity.sessions(user_id);
