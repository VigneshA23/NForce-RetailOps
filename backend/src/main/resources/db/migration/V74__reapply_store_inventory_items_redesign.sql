-- Re-applies the Phase 2 per-store inventory redesign (V70) on top of V72/V73.
-- V72/V73 restored the global inventory_items catalog and the inventory_item_id
-- columns while the code still expected that shape. The code now maps the V70
-- shape again: StoreInventoryItem carries name/unit/category itself and
-- OrderListEntry references store_inventory_item_id. V70's columns, FKs and
-- indexes were never dropped by V72/V73, so only their additions are undone
-- here. IF EXISTS keeps this safe on a fresh DB and on the shared dev DB alike.

DROP INDEX IF EXISTS uq_order_list_entries_active_item;

ALTER TABLE order_list_entries
    DROP CONSTRAINT IF EXISTS fk_order_list_entries_item,
    DROP COLUMN IF EXISTS inventory_item_id;

DROP INDEX IF EXISTS uq_store_inventory_items_store_item;

ALTER TABLE store_inventory_items
    DROP CONSTRAINT IF EXISTS fk_store_inventory_items_inventory_item,
    DROP COLUMN IF EXISTS inventory_item_id;

DROP TABLE IF EXISTS inventory_items;
