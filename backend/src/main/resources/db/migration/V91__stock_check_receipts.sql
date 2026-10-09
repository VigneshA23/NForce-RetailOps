-- One row per delivery (an order marked Received), so the count history can show
-- who received what and when. stock_check_id is the day's stock-check row the
-- delivery was added to; it is null when the item had no row that day, in which
-- case the delivery is added on top of the latest count instead. count_after is
-- the usable stock right after the delivery.
CREATE TABLE stock_check_receipts (
    id                         BIGSERIAL PRIMARY KEY,
    store_id                   BIGINT        NOT NULL REFERENCES stores (id),
    store_inventory_item_id    BIGINT        NOT NULL REFERENCES store_inventory_items (id),
    stock_check_id             BIGINT        REFERENCES stock_checks (id),
    quantity                   NUMERIC(12,2) NOT NULL,
    count_after                NUMERIC(12,2) NOT NULL,
    received_by_user_id        BIGINT        REFERENCES users (id),
    received_by_super_admin_id BIGINT        REFERENCES super_admins (super_admin_id) ON DELETE SET NULL,
    received_at                TIMESTAMPTZ   NOT NULL
);

CREATE INDEX idx_stock_check_receipts_item ON stock_check_receipts (store_inventory_item_id, received_at DESC);
CREATE INDEX idx_stock_check_receipts_store ON stock_check_receipts (store_id);
