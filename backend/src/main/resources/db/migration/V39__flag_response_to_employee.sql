-- "Flag back to employee" correction path: lets an admin return a response to
-- the employee for correction rather than directly editing the value themselves.
-- A flagged response stays active so it remains visible in history; the flag_reason
-- tells the employee what to fix. On resubmission the flagged row is deactivated
-- (history preserved) and a new active row is created.

ALTER TABLE task_responses
    ADD COLUMN flagged_needs_correction BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN flag_reason              VARCHAR(500);

-- correction_type distinguishes a direct admin value-edit ('DIRECT') from a
-- "flag back" action ('FLAG_TO_EMPLOYEE') in the admin_corrections audit trail.
ALTER TABLE admin_corrections
    ADD COLUMN correction_type VARCHAR(30) NOT NULL DEFAULT 'DIRECT';

CREATE INDEX idx_task_responses_flagged
    ON task_responses(store_id, response_date)
    WHERE flagged_needs_correction = TRUE;
