-- Tracks how a task_responses row came to exist: a normal same-day submission,
-- an employee explicitly completing a past missed instance ("Complete Now"), or
-- an auto-generated makeup row created when today's checklist completion
-- fulfilled a pending link to an earlier missed instance (see
-- V65__task_makeup_links.sql). History surfaces MAKEUP_NOW/LINK_FULFILLED rows
-- with a distinct tag, and LINK_FULFILLED rows are permanent -- never undoable
-- or admin-correctable (see TaskService.undoResponse / AdminCorrectionService).
alter table task_responses add column completed_via varchar(20) not null default 'NORMAL';
