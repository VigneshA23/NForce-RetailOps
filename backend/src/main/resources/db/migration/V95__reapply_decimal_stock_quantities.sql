-- Re-applies V86 (decimal stock quantities). The shared dev DB runs with
-- validate-on-migrate off, so a database that already had a later migration
-- applied can silently skip an older V86, leaving INTEGER columns that
-- Hibernate's schema validation rejects (expecting NUMERIC). Altering a column
-- that is already NUMERIC(12,2) to NUMERIC(12,2) is a no-op, so this is safe
-- to run everywhere.
ALTER TABLE store_inventory_items
    ALTER COLUMN min_weekday TYPE NUMERIC(12,2),
    ALTER COLUMN min_weekend TYPE NUMERIC(12,2);

ALTER TABLE stock_checks
    ALTER COLUMN current_count            TYPE NUMERIC(12,2),
    ALTER COLUMN quantity_needed          TYPE NUMERIC(12,2),
    ALTER COLUMN start_of_day_available   TYPE NUMERIC(12,2),
    ALTER COLUMN start_of_day_dead_stock  TYPE NUMERIC(12,2),
    ALTER COLUMN end_of_day_available     TYPE NUMERIC(12,2),
    ALTER COLUMN end_of_day_dead_stock    TYPE NUMERIC(12,2),
    ALTER COLUMN required_tomorrow        TYPE NUMERIC(12,2);

ALTER TABLE stock_check_corrections
    ALTER COLUMN original_count        TYPE NUMERIC(12,2),
    ALTER COLUMN corrected_count       TYPE NUMERIC(12,2),
    ALTER COLUMN original_dead_stock   TYPE NUMERIC(12,2),
    ALTER COLUMN corrected_dead_stock  TYPE NUMERIC(12,2);

ALTER TABLE order_list_entries
    ALTER COLUMN quantity_needed  TYPE NUMERIC(12,2),
    ALTER COLUMN manual_addition  TYPE NUMERIC(12,2);
