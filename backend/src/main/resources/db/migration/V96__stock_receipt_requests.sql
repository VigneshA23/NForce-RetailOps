-- An employee reporting received stock at End of Day no longer changes stock
-- directly: it becomes a request the store's Owner/Admin approves or rejects.
-- order_list_entry_id is set when the employee confirmed an existing Ordered
-- order as received, null for newly reported stock with no order behind it.
CREATE TABLE stock_receipt_requests (
    id                       BIGSERIAL PRIMARY KEY,
    store_id                 BIGINT        NOT NULL REFERENCES stores(id),
    store_inventory_item_id  BIGINT        NOT NULL REFERENCES store_inventory_items(id),
    order_list_entry_id      BIGINT        REFERENCES order_list_entries(id),
    check_date               DATE          NOT NULL,
    quantity                 NUMERIC(12,2) NOT NULL,
    status                   VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    requested_by_user_id     BIGINT        NOT NULL REFERENCES users(id),
    requested_at             TIMESTAMPTZ   NOT NULL,
    decided_by_user_id       BIGINT        REFERENCES users(id),
    decided_at               TIMESTAMPTZ
);

CREATE INDEX idx_stock_receipt_requests_item_date
    ON stock_receipt_requests(store_inventory_item_id, check_date)
    WHERE status = 'PENDING';

-- One pending request per order, so an order can't be confirmed twice.
CREATE UNIQUE INDEX uq_stock_receipt_requests_pending_order
    ON stock_receipt_requests(order_list_entry_id)
    WHERE status = 'PENDING' AND order_list_entry_id IS NOT NULL;

ALTER TABLE notifications
    ADD COLUMN stock_receipt_request_id BIGINT REFERENCES stock_receipt_requests(id) ON DELETE CASCADE;
