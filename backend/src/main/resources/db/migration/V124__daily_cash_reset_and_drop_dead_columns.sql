-- Preserve the complete Daily Cash history while the application moves to the
-- four active amounts: opening_drawer_cash, cash_removed, cash_remaining and
-- other_adjustments (plus derived daily_expected_cash).
--
-- The V121 / V123 legacy amount columns remain nullable and unmapped. Keeping
-- them is intentional: existing entries and correction snapshots retain their
-- original total_cash_sales, bank_deposits and cash_expenses values for audit
-- and reporting. Existing flags, flag history and notifications are preserved
-- as well. New application writes simply leave the legacy columns NULL.
--
-- This file keeps the historical V124 filename/version so databases upgrade in
-- the same order. It must never delete Daily Cash rows or drop legacy columns.

-- Rebuild the non-negative constraint in place. This is schema-only and does
-- not rewrite or remove any historical row. The nullable legacy columns remain
-- validated whenever an older value is present.
ALTER TABLE daily_cash_entries DROP CONSTRAINT IF EXISTS chk_daily_cash_entries_non_negative;
ALTER TABLE daily_cash_entries ADD CONSTRAINT chk_daily_cash_entries_non_negative CHECK (
    (opening_drawer_cash IS NULL OR opening_drawer_cash >= 0)
    AND (cash_removed IS NULL OR cash_removed >= 0)
    AND (cash_remaining IS NULL OR cash_remaining >= 0)
    AND (cash_expenses IS NULL OR cash_expenses >= 0)
    AND (total_cash_sales IS NULL OR total_cash_sales >= 0)
    AND (bank_deposits IS NULL OR bank_deposits >= 0));
