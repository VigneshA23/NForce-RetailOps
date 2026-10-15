-- A Start of Day with no End of Day the next day is chased from the first
-- login after it. Whoever answers first either enters the missing End of Day
-- count (the normal end_of_day_* columns, entered-by recorded as usual) or
-- says it could not be counted: that leaves End of Day null and keeps the
-- reason here instead.
ALTER TABLE stock_checks
    ADD COLUMN end_of_day_skipped_reason TEXT,
    ADD COLUMN end_of_day_skipped_by     BIGINT REFERENCES users(id),
    ADD COLUMN end_of_day_skipped_at     TIMESTAMPTZ;

-- The notice itself is one notification per recipient per store and day; the
-- items listed in it are worked out live from stock_checks for this date.
ALTER TABLE notifications
    ADD COLUMN missed_eod_date DATE;
