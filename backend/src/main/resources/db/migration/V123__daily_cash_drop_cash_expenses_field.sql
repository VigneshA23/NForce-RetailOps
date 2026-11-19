-- Cash expenses is removed from Daily Cash across every store and role. As with
-- total_cash_sales / bank_deposits (V121), the columns are NOT physically dropped:
-- other branches share the dev database and their code still reads and writes
-- them. They become nullable, unmapped dead columns; drop them in a later
-- migration once no live branch uses them.
--
-- Expected cash no longer subtracts expenses, so the figure for an old entry
-- that recorded expenses changes. daily_expected_cash (cash_remaining +
-- other_adjustments, V120) never included them and is unaffected.
ALTER TABLE daily_cash_entries ALTER COLUMN cash_expenses DROP NOT NULL;
ALTER TABLE daily_cash_entry_corrections ALTER COLUMN previous_cash_expenses DROP NOT NULL;
-- new_cash_expenses (V118) was already nullable.

-- The non-negative check named cash_expenses; rebuild it over what remains.
ALTER TABLE daily_cash_entries DROP CONSTRAINT IF EXISTS chk_daily_cash_entries_non_negative;
ALTER TABLE daily_cash_entries ADD CONSTRAINT chk_daily_cash_entries_non_negative CHECK (
    opening_drawer_cash >= 0 AND cash_removed >= 0 AND cash_remaining >= 0
    AND (cash_expenses IS NULL OR cash_expenses >= 0)
    AND (total_cash_sales IS NULL OR total_cash_sales >= 0)
    AND (bank_deposits IS NULL OR bank_deposits >= 0));
