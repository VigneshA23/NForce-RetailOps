-- When an order list entry was marked Ordered. Kept after the entry moves on to
-- Received, so a day's End of Day report can still show what was ordered that
-- day. Entries already Ordered are backfilled from their last update; Received
-- ones are left null since they may have been auto-resolved rather than ordered.
ALTER TABLE order_list_entries ADD COLUMN ordered_at TIMESTAMPTZ;

UPDATE order_list_entries SET ordered_at = updated_at WHERE status = 'ORDERED';

CREATE INDEX idx_order_list_entries_store_ordered_at ON order_list_entries (store_id, ordered_at);
