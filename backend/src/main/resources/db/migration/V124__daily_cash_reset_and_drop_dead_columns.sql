-- Daily Cash reset. All existing cash data is discarded and the dead columns
-- left behind by V121 / V123 are physically dropped, so daily_cash_entries
-- carries only the four required amounts: opening_drawer_cash, cash_removed,
-- cash_remaining, other_adjustments (plus the derived daily_expected_cash).
--
-- DESTRUCTIVE and irreversible. Branches that still read or write
-- total_cash_sales / bank_deposits / cash_expenses (or the matching
-- previous_* / new_* correction columns) will fail against this schema.

-- 1. Delete rows, children first (FK order).
DELETE FROM daily_cash_entry_flag_history;
DELETE FROM daily_cash_entry_flags;
DELETE FROM daily_cash_entry_corrections;
DELETE FROM daily_cash_entries;

-- Notifications raised by cash flags would now point at entries that no longer exist.
DELETE FROM notifications
WHERE category = 'CASH_ENTRY_FLAGGED' OR link_path LIKE '/cash?date=%';

-- 2. The check constraint names columns about to be dropped; rebuild it.
ALTER TABLE daily_cash_entries DROP CONSTRAINT IF EXISTS chk_daily_cash_entries_non_negative;

ALTER TABLE daily_cash_entries DROP COLUMN IF EXISTS total_cash_sales;
ALTER TABLE daily_cash_entries DROP COLUMN IF EXISTS bank_deposits;
ALTER TABLE daily_cash_entries DROP COLUMN IF EXISTS cash_expenses;

ALTER TABLE daily_cash_entries ADD CONSTRAINT chk_daily_cash_entries_non_negative CHECK (
    opening_drawer_cash >= 0 AND cash_removed >= 0 AND cash_remaining >= 0);

-- 3. Same on the corrections trail (previous_* from V108, new_* from V118).
ALTER TABLE daily_cash_entry_corrections DROP COLUMN IF EXISTS previous_total_cash_sales;
ALTER TABLE daily_cash_entry_corrections DROP COLUMN IF EXISTS previous_bank_deposits;
ALTER TABLE daily_cash_entry_corrections DROP COLUMN IF EXISTS previous_cash_expenses;
ALTER TABLE daily_cash_entry_corrections DROP COLUMN IF EXISTS new_total_cash_sales;
ALTER TABLE daily_cash_entry_corrections DROP COLUMN IF EXISTS new_bank_deposits;
ALTER TABLE daily_cash_entry_corrections DROP COLUMN IF EXISTS new_cash_expenses;
