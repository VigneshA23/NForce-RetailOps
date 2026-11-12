-- RTS-484: per-IP failed-attempt tracking for /internal/jobs/** secret checks.
-- Same shape as login_attempts (V34); purged by the existing hourly purge job.
CREATE TABLE internal_job_attempts (
    id           BIGSERIAL    PRIMARY KEY,
    ip_address   TEXT         NOT NULL,
    attempted_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_internal_job_attempts_ip_time ON internal_job_attempts(ip_address, attempted_at DESC);
