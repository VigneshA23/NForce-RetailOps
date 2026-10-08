-- Records which role last moved an order-list entry to its current status, so
-- a second person acting on a stale view (Owner/Admin and Super Admin can both
-- edit the same entry) can be told "already updated by Super Admin" instead of
-- silently overwriting. NULL = never manually changed (or changed by the
-- system, e.g. auto-received by a fresh stock count).
ALTER TABLE order_list_entries
    ADD COLUMN status_changed_by_role VARCHAR(20);
