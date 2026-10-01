-- Splits the single daily count into two independent snapshots per item per
-- business day: Start of Day (opening) and End of Day (closing), each with
-- its own available / dead-stock figures and who/when. Still ONE stock_checks
-- row per store + item + day -- saving a snapshot again updates it in place.
--
-- The pre-existing columns stay and stay NOT NULL so other branches sharing
-- the dev database keep working, but their meaning is now derived:
--   current_count      = usable stock (available - dead) of the latest snapshot
--   quantity_needed    = quantity to order, computed when EOD is saved (0 before)
--   checked_by_user_id = whoever last saved either snapshot

ALTER TABLE stock_checks
    ADD COLUMN store_id                     BIGINT,
    ADD COLUMN start_of_day_available       INTEGER,
    ADD COLUMN start_of_day_dead_stock      INTEGER,
    ADD COLUMN start_of_day_entered_by      BIGINT REFERENCES users(id),
    ADD COLUMN start_of_day_entered_at      TIMESTAMPTZ,
    ADD COLUMN start_of_day_checked_by      BIGINT REFERENCES users(id),
    ADD COLUMN start_of_day_checked_at      TIMESTAMPTZ,
    ADD COLUMN end_of_day_available         INTEGER,
    ADD COLUMN end_of_day_dead_stock        INTEGER,
    ADD COLUMN end_of_day_entered_by        BIGINT REFERENCES users(id),
    ADD COLUMN end_of_day_entered_at        TIMESTAMPTZ,
    ADD COLUMN end_of_day_checked_by        BIGINT REFERENCES users(id),
    ADD COLUMN end_of_day_checked_at        TIMESTAMPTZ,
    ADD COLUMN required_tomorrow            INTEGER,
    ADD COLUMN updated_at                   TIMESTAMPTZ;

UPDATE stock_checks sc
SET store_id = sii.store_id
FROM store_inventory_items sii
WHERE sii.id = sc.store_inventory_item_id;

-- Existing single counts were the day's closing figure that drove the order
-- list, so they become the End of Day snapshot with no dead stock recorded.
UPDATE stock_checks
SET end_of_day_available  = current_count,
    end_of_day_dead_stock = 0,
    end_of_day_entered_by = checked_by_user_id,
    end_of_day_entered_at = created_at,
    end_of_day_checked_by = checked_by_user_id,
    end_of_day_checked_at = created_at,
    updated_at            = created_at;

ALTER TABLE stock_checks
    ALTER COLUMN store_id SET NOT NULL,
    ALTER COLUMN updated_at SET NOT NULL,
    ALTER COLUMN quantity_needed SET DEFAULT 0,
    ADD CONSTRAINT fk_stock_checks_store FOREIGN KEY (store_id) REFERENCES stores(id),
    ADD CONSTRAINT ck_stock_checks_sod_dead_within_available
        CHECK (start_of_day_dead_stock IS NULL OR start_of_day_dead_stock <= start_of_day_available),
    ADD CONSTRAINT ck_stock_checks_eod_dead_within_available
        CHECK (end_of_day_dead_stock IS NULL OR end_of_day_dead_stock <= end_of_day_available);

-- Store + item + business date. uq_stock_checks_item_date (V48) already
-- implies this since an item belongs to exactly one store; this one also
-- serves the store-scoped report/history queries.
CREATE UNIQUE INDEX uq_stock_checks_store_item_date
    ON stock_checks(store_id, store_inventory_item_id, check_date);

-- stock_check_corrections now audits every edit of an existing snapshot,
-- by employees as well as Owner/Admin. original_count / corrected_count keep
-- holding the available figure; dead stock and which snapshot are new.
-- Existing rows were corrections to the single count, i.e. the EOD snapshot.
ALTER TABLE stock_check_corrections
    ADD COLUMN snapshot              VARCHAR(16) NOT NULL DEFAULT 'END_OF_DAY',
    ADD COLUMN original_dead_stock   INTEGER,
    ADD COLUMN corrected_dead_stock  INTEGER,
    ADD CONSTRAINT ck_stock_check_corrections_snapshot CHECK (snapshot IN ('START_OF_DAY', 'END_OF_DAY'));
