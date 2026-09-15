-- MULTIPLE-completion tasks previously left every resubmission active, so the same
-- employee could show up with several independent rows for one task/store/day. Going
-- forward, TaskService.submitResponse supersedes an employee's own prior active
-- response on resubmission (same supersededResponseId chain SINGLE already uses for
-- its flag -> resubmit cycle). This backfills existing data to match: for each
-- (task, store, day, employee) group of active MULTIPLE rows, keep only the most
-- recent one active and chain the rest as superseded history.
with ranked as (
    select
        id,
        lag(id) over (
            partition by task_id, store_id, response_date, employee_user_id
            order by created_at asc
        ) as prev_id,
        row_number() over (
            partition by task_id, store_id, response_date, employee_user_id
            order by created_at desc
        ) as rn_desc
    from task_responses
    where active = true and completion_type = 'MULTIPLE'
)
update task_responses t
set superseded_response_id = r.prev_id
from ranked r
where t.id = r.id and r.prev_id is not null and t.superseded_response_id is null;

with ranked as (
    select
        id,
        row_number() over (
            partition by task_id, store_id, response_date, employee_user_id
            order by created_at desc
        ) as rn_desc
    from task_responses
    where active = true and completion_type = 'MULTIPLE'
)
update task_responses t
set active = false, undone_at = now()
from ranked r
where t.id = r.id and r.rn_desc > 1;
