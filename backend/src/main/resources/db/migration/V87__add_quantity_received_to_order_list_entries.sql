-- What was actually delivered when an order was marked Received. Nullable:
-- entries received before this column existed (or auto-resolved by a fresh
-- stock count rather than by hand) have no recorded figure.
ALTER TABLE order_list_entries
    ADD COLUMN quantity_received NUMERIC(12,2);
