-- Daily Cash is reduced to five fields: opening_drawer_cash, cash_expenses,
-- cash_removed, cash_remaining, other_adjustments (the five columns already on
-- daily_cash_entries / daily_cash_entry_corrections stay as they are).
--
-- total_cash_sales and bank_deposits leave the entity, API and UI. Following the
-- V48 precedent they are NOT physically dropped yet: other branches share the dev
-- database and their code still INSERTs/SELECTs these columns, so they are made
-- nullable and left as dead columns. Drop them in a later migration once no live
-- branch reads them.
ALTER TABLE daily_cash_entries ALTER COLUMN total_cash_sales DROP NOT NULL;
ALTER TABLE daily_cash_entries ALTER COLUMN bank_deposits DROP NOT NULL;
ALTER TABLE daily_cash_entry_corrections ALTER COLUMN previous_total_cash_sales DROP NOT NULL;
ALTER TABLE daily_cash_entry_corrections ALTER COLUMN previous_bank_deposits DROP NOT NULL;

-- The non-negative check named the two retired columns; rebuild it over the
-- remaining non-signed amounts (the old columns are still checked when present).
ALTER TABLE daily_cash_entries DROP CONSTRAINT chk_daily_cash_entries_non_negative;
ALTER TABLE daily_cash_entries ADD CONSTRAINT chk_daily_cash_entries_non_negative CHECK (
    opening_drawer_cash >= 0 AND cash_removed >= 0 AND cash_remaining >= 0 AND cash_expenses >= 0
    AND (total_cash_sales IS NULL OR total_cash_sales >= 0)
    AND (bank_deposits IS NULL OR bank_deposits >= 0));

-- entered_by is the employee who first created the entry. Entries from before
-- this release have no known creator, so it becomes nullable (both columns null
-- = "Unknown") and existing rows are cleared. updated_by is untouched.
ALTER TABLE daily_cash_entries DROP CONSTRAINT chk_daily_cash_entries_entered_by;
ALTER TABLE daily_cash_entries ADD CONSTRAINT chk_daily_cash_entries_entered_by CHECK (
    entered_by_user_id IS NULL OR entered_by_super_admin_id IS NULL);
UPDATE daily_cash_entries SET entered_by_user_id = NULL, entered_by_super_admin_id = NULL;
