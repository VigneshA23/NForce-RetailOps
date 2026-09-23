-- "Move missed task instance to a day" repurposes task_makeup_links from a
-- same-day "link to today, auto-fulfilled by copying today's value" mechanism
-- into a general move-to-any-future-date mechanism where the moved instance
-- is independently completed through the normal checklist submit flow
-- (TaskMakeupLinkService, TaskService.submitResponse). No column/constraint
-- change is needed: chk_task_makeup_links_date_order (past_date < linked_date)
-- already permits linked_date to be any date after past_date, not just today.
--
-- idx_task_makeup_links_fulfillment backed the old lockPendingForFulfillment
-- query (removed along with the auto-fulfillment-on-completion feature).
-- Replaced by an index keyed off (store_id, linked_date, status), because the
-- checklist read now loads every moved unit for the store on one date in a
-- single query (TaskMakeupLinkRepository.findByStoreIdAndLinkedDateAndStatusIn),
-- not one lookup per task.
drop index idx_task_makeup_links_fulfillment;

create index idx_task_makeup_links_target_date
    on task_makeup_links (store_id, linked_date, status);
