-- Stock quantities become decimal so items measured in kg / litres can be
-- counted as 1.25, 1.50 etc. NUMERIC(12,2) keeps two decimal places; existing
-- whole-number values convert losslessly (5 -> 5.00).
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
