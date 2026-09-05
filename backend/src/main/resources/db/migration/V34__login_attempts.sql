CREATE TABLE login_attempts (
    id           BIGSERIAL    PRIMARY KEY,
    email        TEXT         NOT NULL,
    attempted_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Covering index: lookups are always (email, attempted_at > window_start)
CREATE INDEX idx_login_attempts_email_time ON login_attempts(email, attempted_at DESC);
