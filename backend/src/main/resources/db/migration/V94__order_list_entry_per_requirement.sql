-- Each order requirement is now its own order_list_entries row, managed
-- independently (Needs Ordering -> Ordered -> Received), so an item may have
-- several active rows at once -- e.g. one already Ordered and a new Needs
-- Ordering one raised by a later count, or a manual "Add to order".
--
-- The old one-active-row-per-item unique index is replaced by a narrower
-- backstop: at most one system-raised (ad_hoc = false) Needs Ordering row per
-- item, which is the row a stock count updates in place.
DROP INDEX IF EXISTS idx_order_list_entries_active;
DROP INDEX IF EXISTS uq_order_list_entries_active_item;

CREATE UNIQUE INDEX idx_order_list_entries_open_system_row
    ON order_list_entries(store_id, store_inventory_item_id)
    WHERE status = 'NEEDS_ORDERING' AND ad_hoc = false;

CREATE INDEX idx_order_list_entries_active_item
    ON order_list_entries(store_id, store_inventory_item_id)
    WHERE status <> 'RECEIVED';

-- Existing data may already hold a second open system row only if the old
-- index was bypassed; the old index forbade it, so no cleanup is needed.
