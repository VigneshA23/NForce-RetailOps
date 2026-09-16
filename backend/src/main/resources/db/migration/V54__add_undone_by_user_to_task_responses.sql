-- Distinguishes an employee's own explicit Undo click from a response being
-- deactivated purely as a side effect of a fresh resubmission superseding it
-- (TaskService.submitResponse's auto-supersede paths never set this column) --
-- needed so a standalone Undo with no resubmission afterward can still surface in
-- Employee/Owner/Super Admin history as "value -> Not done, Undone by X · time"
-- instead of silently vanishing once the response is no longer active.
alter table task_responses add column undone_by_user boolean not null default false;
