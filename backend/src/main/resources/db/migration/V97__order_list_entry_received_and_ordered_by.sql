-- The permanent "ordered on this day" (ordered_at, V93) had no counterpart
-- for who ordered it, and there was no "received on this day / by whom" at
-- all -- the only receipt-time signal was the generic updated_at (changes on
-- any edit, not just receipt). Names are stored denormalized (not a user_id
-- FK), the same convention activity_log and status_changed_by_role already
-- use here, since the acting role can be Super Admin, which has no row in
-- users to reference.
ALTER TABLE order_list_entries
    ADD COLUMN ordered_by_name  TEXT,
    ADD COLUMN received_at      TIMESTAMPTZ,
    ADD COLUMN received_by_name TEXT;
