-- Start of Day is now reconciled against yesterday's End of Day. A restock can
-- be reported at either count (snapshot), and a Start of Day lower than
-- yesterday's End of Day goes to the Owner/Admin as a LOWER_COUNT request with
-- the employee's reason. RESTOCK rows are the existing received-stock requests.
ALTER TABLE stock_receipt_requests
    ADD COLUMN snapshot     VARCHAR(20) NOT NULL DEFAULT 'END_OF_DAY',
    ADD COLUMN request_type VARCHAR(20) NOT NULL DEFAULT 'RESTOCK',
    ADD COLUMN reason       TEXT;

-- Mid-day shortage reports, so each one shows in the Inventory Counts history
-- (stock_checks keeps only the latest checkpoint, with no who/when).
CREATE TABLE stock_shortage_reports (
    id                       BIGSERIAL PRIMARY KEY,
    store_id                 BIGINT        NOT NULL REFERENCES stores(id),
    store_inventory_item_id  BIGINT        NOT NULL REFERENCES store_inventory_items(id),
    check_date               DATE          NOT NULL,
    reported_usable          NUMERIC(12,2) NOT NULL,
    reported_by_user_id      BIGINT        NOT NULL REFERENCES users(id),
    reported_at              TIMESTAMPTZ   NOT NULL,
    note                     TEXT
);

CREATE INDEX idx_stock_shortage_reports_item
    ON stock_shortage_reports(store_inventory_item_id, reported_at DESC);
