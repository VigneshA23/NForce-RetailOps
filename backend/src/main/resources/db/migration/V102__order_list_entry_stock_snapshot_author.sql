-- Who recorded the stock snapshot on an order row and when (V101), shown under
-- the item name. Denormalized name, not a user FK: the actor can be Super
-- Admin, which has no row in `users`. Null where V101's snapshot is null.
ALTER TABLE order_list_entries
    ADD COLUMN stock_at_order_by_name VARCHAR(255),
    ADD COLUMN stock_at_order_at      TIMESTAMP WITH TIME ZONE;
