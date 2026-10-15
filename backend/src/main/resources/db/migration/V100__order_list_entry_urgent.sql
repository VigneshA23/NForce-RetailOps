-- An item that has run out entirely (zero stock at Start of Day, or reported
-- as zero mid-day) is flagged urgent so the Order List can highlight it.
ALTER TABLE order_list_entries ADD COLUMN urgent BOOLEAN NOT NULL DEFAULT FALSE;
