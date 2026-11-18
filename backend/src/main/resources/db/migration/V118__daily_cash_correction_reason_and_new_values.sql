-- Direct corrections of a daily cash entry by an Owner/Admin or Super Admin
-- now record why, and what the figures were changed to, alongside the old
-- values V108 already keeps. Still append-only: rows are only ever inserted.
--
-- Nullable because corrections saved before this release have neither; every
-- new correction sets them (DailyCashEntryService).
ALTER TABLE daily_cash_entry_corrections ADD COLUMN IF NOT EXISTS reason                  VARCHAR(500);
ALTER TABLE daily_cash_entry_corrections ADD COLUMN IF NOT EXISTS new_total_cash_sales    NUMERIC(12,2);
ALTER TABLE daily_cash_entry_corrections ADD COLUMN IF NOT EXISTS new_opening_drawer_cash NUMERIC(12,2);
ALTER TABLE daily_cash_entry_corrections ADD COLUMN IF NOT EXISTS new_cash_removed        NUMERIC(12,2);
ALTER TABLE daily_cash_entry_corrections ADD COLUMN IF NOT EXISTS new_cash_remaining      NUMERIC(12,2);
ALTER TABLE daily_cash_entry_corrections ADD COLUMN IF NOT EXISTS new_cash_expenses       NUMERIC(12,2);
ALTER TABLE daily_cash_entry_corrections ADD COLUMN IF NOT EXISTS new_bank_deposits       NUMERIC(12,2);
ALTER TABLE daily_cash_entry_corrections ADD COLUMN IF NOT EXISTS new_other_adjustments   NUMERIC(12,2);
