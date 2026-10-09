-- Stock delivered during the business day (orders marked Received). Tracked
-- apart from the Start/End of Day counts so "stock used" can exclude it:
-- used = SOD usable + received - EOD usable.
ALTER TABLE stock_checks
    ADD COLUMN quantity_received NUMERIC(12,2) NOT NULL DEFAULT 0;
