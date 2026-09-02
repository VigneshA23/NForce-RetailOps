-- Supports the admin checklist-history summary/detail reconstruction, which reads by
-- (store_id, response_date[range]) without a task_id predicate -- idx_task_responses_lookup
-- (task_id, store_id, response_date) can't serve that access pattern since task_id leads it.
-- Partial on active=true since both new queries only ever want active responses.
create index idx_task_responses_store_date on task_responses (store_id, response_date) where active = true;
