-- Daily Cash: opening drawer cash is now saved on its own (a separate form for
-- employees), and Owner/Admin / Super Admin entries no longer require every
-- amount. So opening_drawer_cash, cash_removed and cash_remaining may each be
-- NULL = "not recorded yet". other_adjustments stays NOT NULL (blank = 0), and
-- daily_expected_cash stays NOT NULL (cash_remaining + other_adjustments, with
-- a missing cash_remaining counted as 0). The non-negative check already
-- passes for NULL.
ALTER TABLE daily_cash_entries ALTER COLUMN opening_drawer_cash DROP NOT NULL;
ALTER TABLE daily_cash_entries ALTER COLUMN cash_removed DROP NOT NULL;
ALTER TABLE daily_cash_entries ALTER COLUMN cash_remaining DROP NOT NULL;

-- The corrections trail snapshots the old values, which may now be NULL too.
ALTER TABLE daily_cash_entry_corrections ALTER COLUMN previous_opening_drawer_cash DROP NOT NULL;
ALTER TABLE daily_cash_entry_corrections ALTER COLUMN previous_cash_removed DROP NOT NULL;
ALTER TABLE daily_cash_entry_corrections ALTER COLUMN previous_cash_remaining DROP NOT NULL;
