-- Admin Corrections audit trail: every admin edit to a submitted employee
-- response is immutably recorded here with the original value, corrected value,
-- who made the change, and when. The task_responses row is updated in place;
-- this table is the permanent history of every such mutation.
CREATE TABLE admin_corrections (
    id                       BIGSERIAL PRIMARY KEY,
    task_response_id         BIGINT        NOT NULL REFERENCES task_responses(id),
    -- Snapshot of the value as it existed BEFORE this correction.
    original_value_boolean   BOOLEAN,
    original_value_numeric   DOUBLE PRECISION,
    original_value_text      TEXT,
    -- The new value written to task_responses by this correction.
    corrected_value_boolean  BOOLEAN,
    corrected_value_numeric  DOUBLE PRECISION,
    corrected_value_text     TEXT,
    corrected_by_user_id     BIGINT        NOT NULL REFERENCES users(id),
    corrected_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    reason                   VARCHAR(200)
);

CREATE INDEX idx_admin_corrections_task_response_id ON admin_corrections(task_response_id);
