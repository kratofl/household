CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE audit.events (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_user_id UUID,
    actor_role varchar(64) NOT NULL DEFAULT '',
    action varchar(128) NOT NULL,
    module varchar(64) NOT NULL,
    target_type varchar(128) NOT NULL DEFAULT '',
    target_id varchar(128) NOT NULL DEFAULT '',
    outcome varchar(32) NOT NULL,
    request_id varchar(128) NOT NULL DEFAULT '',
    ip varchar(128) NOT NULL DEFAULT '',
    user_agent varchar(512) NOT NULL DEFAULT '',
    metadata jsonb NOT NULL DEFAULT '{}',
    before jsonb,
    after jsonb,
    error_code varchar(128) NOT NULL DEFAULT ''
);

CREATE INDEX audit_events_occurred_at_idx ON audit.events (occurred_at DESC);
CREATE INDEX audit_events_actor_user_id_idx ON audit.events (actor_user_id);
CREATE INDEX audit_events_module_action_idx ON audit.events (module, action);
CREATE INDEX audit_events_outcome_idx ON audit.events (outcome);
