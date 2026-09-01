-- Denormalized copy of the task's completion type at submission time, the same way
-- response_type is already denormalized onto this table (V18) -- needed here because a
-- partial index's WHERE clause can't reach across a join to tasks.completion_type.
alter table task_responses add column completion_type varchar(20);
update task_responses set completion_type = 'SINGLE' where completion_type is null;
alter table task_responses alter column completion_type set not null;

-- Enforces "first active response wins" for SINGLE tasks at the database level, closing
-- the check-then-act race in TaskService.submitResponse (two concurrent submits can both
-- pass the in-memory pre-check before either commits). MULTIPLE tasks are excluded from
-- the predicate, so they keep allowing unlimited active rows per task/store/day.
create unique index idx_task_responses_single_active
    on task_responses (task_id, store_id, response_date)
    where active = true and completion_type = 'SINGLE';
