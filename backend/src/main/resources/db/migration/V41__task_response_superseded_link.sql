-- Links a resubmitted response back to the flagged response it replaced. When
-- TaskService.submitResponse accepts a resubmission it deactivates the flagged
-- row (as it already did) and now also records that row's id on the new one,
-- so the flag -> resubmit chain (original value, owner comment, flagged-by,
-- timestamps, new value) stays walkable via existing task_responses /
-- admin_corrections rows -- no other new columns/tables needed.
ALTER TABLE task_responses
    ADD COLUMN superseded_response_id BIGINT REFERENCES task_responses(id);

CREATE INDEX idx_task_responses_superseded ON task_responses(superseded_response_id);
