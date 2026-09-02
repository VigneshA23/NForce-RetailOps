-- TaskService.deleteTask now guards against deleting a task with checklist history
-- (throws TaskHasHistoryException, 409). Tightening the FK from cascade to restrict is
-- defense-in-depth: any future code path that calls taskRepository.delete(task) directly,
-- bypassing that guard, now fails loudly instead of silently wiping task_responses history.
alter table task_responses drop constraint fk_task_responses_task;
alter table task_responses add constraint fk_task_responses_task
    foreign key (task_id) references tasks on delete restrict;
