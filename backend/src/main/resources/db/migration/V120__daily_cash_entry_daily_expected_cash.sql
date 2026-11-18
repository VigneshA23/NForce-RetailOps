-- RTS story: Expected cash on hand as of the viewed date.
--
-- Daily expected cash = cash_remaining + other_adjustments. Persisted on the
-- row so the Owner/Admin and Super Admin responses can carry the saved figure
-- without re-deriving it, and so the running sum query can SUM one column
-- instead of adding two. The migration backfills from existing rows (there is
-- no older "cash entry" schema with different column names on this branch --
-- cash_remaining and other_adjustments have been the names since V108), so
-- every row that exists today gets its figure without user action.

ALTER TABLE daily_cash_entries
    ADD COLUMN daily_expected_cash NUMERIC(14, 2);

UPDATE daily_cash_entries
    SET daily_expected_cash = cash_remaining + other_adjustments;

ALTER TABLE daily_cash_entries
    ALTER COLUMN daily_expected_cash SET NOT NULL;

-- Matching snapshot on the audit trail: the pre-change daily figure, so a
-- "what did this day's expected cash look like before the correction" is
-- answerable from the correction row alone. Old rows (from before this
-- migration) have none -- left NULL.
ALTER TABLE daily_cash_entry_corrections
    ADD COLUMN previous_daily_expected_cash NUMERIC(14, 2);
