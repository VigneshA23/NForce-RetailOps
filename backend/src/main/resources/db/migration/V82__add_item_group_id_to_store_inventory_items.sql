-- Links the per-store copies of an item that Super Admin created for several
-- stores in one go. Null for items created for a single store by an
-- Owner/Admin, and for everything created before this migration.
ALTER TABLE store_inventory_items ADD COLUMN item_group_id UUID;

CREATE INDEX idx_store_inventory_items_item_group_id
    ON store_inventory_items (item_group_id)
    WHERE item_group_id IS NOT NULL;
