CREATE TABLE password_reset_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    email       TEXT         NOT NULL,
    token       UUID         NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ
);

CREATE INDEX idx_prt_email ON password_reset_tokens (email);
CREATE INDEX idx_prt_token ON password_reset_tokens (token);
