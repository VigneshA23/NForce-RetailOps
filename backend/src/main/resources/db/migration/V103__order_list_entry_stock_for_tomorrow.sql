-- True when the stock snapshot (V101) was taken against tomorrow's minimum,
-- i.e. the row was raised from an End of Day count. Shown as a "Tomorrow" tag.
ALTER TABLE order_list_entries
    ADD COLUMN stock_for_tomorrow BOOLEAN NOT NULL DEFAULT FALSE;
