-- What the item's usable stock and required minimum were when this order row
-- was raised (or last recalculated while still waiting to be ordered). The
-- Order List shows these instead of the item's live stock, so a row marked
-- Ordered keeps the figures it was ordered against even after a later count or
-- shortage report changes the stock. Null for rows raised before this column
-- existed and for manual "Add to order" rows, which have no count behind them.
ALTER TABLE order_list_entries
    ADD COLUMN stock_at_order   NUMERIC(12,2),
    ADD COLUMN minimum_at_order NUMERIC(12,2);
