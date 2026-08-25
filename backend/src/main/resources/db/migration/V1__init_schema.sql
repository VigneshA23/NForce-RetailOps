-- Phase 1: core auth/access model + daily checklist domain

CREATE TABLE stores (
    id     BIGSERIAL PRIMARY KEY,
    name   TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_store_access (
    user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, store_id)
);

CREATE TABLE categories (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE tasks (
    id              BIGSERIAL PRIMARY KEY,
    category_id     BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name            TEXT NOT NULL,
    description     TEXT,
    response_type   TEXT NOT NULL CHECK (response_type IN ('YES_NO', 'DONE_CHECKBOX', 'NUMBER', 'SHORT_TEXT')),
    completion_type TEXT NOT NULL CHECK (completion_type IN ('SINGLE', 'MULTIPLE')),
    schedule_type   TEXT NOT NULL CHECK (schedule_type IN ('DAILY', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM_DAYS', 'ONE_TIME')),
    custom_days     TEXT,
    one_time_date   DATE,
    display_order   INT NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE task_stores (
    task_id  BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, store_id)
);

CREATE TABLE task_completions (
    id              BIGSERIAL PRIMARY KEY,
    task_id         BIGINT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    store_id        BIGINT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    completion_date DATE NOT NULL,
    response_value  TEXT,
    completed_by    BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_completions_store_date ON task_completions(store_id, completion_date);
CREATE INDEX idx_task_completions_task ON task_completions(task_id);

CREATE TABLE task_corrections (
    id                  BIGSERIAL PRIMARY KEY,
    task_completion_id  BIGINT NOT NULL REFERENCES task_completions(id) ON DELETE CASCADE,
    original_value      TEXT,
    updated_value       TEXT,
    corrected_by        BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    corrected_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed data: roles and stores are examples, not hardcoded structure — more can be added later via INSERT
INSERT INTO roles (name, description) VALUES
    ('EMPLOYEE', 'Can complete daily tasks for their authorized store(s)'),
    ('OWNER_ADMIN', 'Full access: configuration, all stores, corrections, reporting');

INSERT INTO stores (name) VALUES
    ('Store 1'),
    ('Store 2');
