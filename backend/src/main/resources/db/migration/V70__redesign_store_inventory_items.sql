-- Phase 2 Inventory redesign: inventory becomes a true per-store entity.
-- Previously `inventory_items` was a *global* catalog (name/unit/category
-- shared across every store) and `store_inventory_items` was a thin
-- per-store "assignment" row that only carried min-stock thresholds and a
-- preferred supplier. Both Super Admin and Owner/Admin now manage their own
-- store's items directly -- name/unit/category/note all live per store, so
-- the same product name can exist independently in multiple stores. The
-- weekday/weekend minimum-quantity split is kept unchanged.

ALTER TABLE store_inventory_items
    ADD COLUMN name TEXT,
    ADD COLUMN unit_of_measurement TEXT,
    ADD COLUMN category_id BIGINT,
    ADD COLUMN note TEXT;

UPDATE store_inventory_items sii
    SET name = ii.name,
        unit_of_measurement = ii.unit_of_measurement,
        category_id = ii.category_id
    FROM inventory_items ii
    WHERE sii.inventory_item_id = ii.id;

ALTER TABLE store_inventory_items
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN unit_of_measurement SET NOT NULL,
    ALTER COLUMN category_id SET NOT NULL;

ALTER TABLE store_inventory_items
    ADD CONSTRAINT fk_store_inventory_items_category FOREIGN KEY (category_id) REFERENCES inventory_categories(id);

CREATE INDEX idx_store_inventory_items_category ON store_inventory_items(category_id);

-- order_list_entries used to reference the global catalog item directly so
-- an order survived the catalog assignment being deactivated. Now that the
-- item itself lives on store_inventory_items (and is only ever deleted when
-- it has no stock-check/order history -- see StoreInventoryItemService),
-- point there instead, mirroring stock_checks' existing FK shape.
ALTER TABLE order_list_entries
    ADD COLUMN store_inventory_item_id BIGINT;

UPDATE order_list_entries ole
    SET store_inventory_item_id = sii.id
    FROM store_inventory_items sii
    WHERE ole.store_id = sii.store_id AND ole.inventory_item_id = sii.inventory_item_id;

ALTER TABLE order_list_entries
    ALTER COLUMN store_inventory_item_id SET NOT NULL;

DROP INDEX idx_order_list_entries_active;

ALTER TABLE order_list_entries
    ADD CONSTRAINT fk_order_list_entries_store_inventory_item FOREIGN KEY (store_inventory_item_id) REFERENCES store_inventory_items(id),
    DROP CONSTRAINT fk_order_list_entries_item,
    DROP COLUMN inventory_item_id;

CREATE UNIQUE INDEX idx_order_list_entries_active ON order_list_entries(store_id, store_inventory_item_id) WHERE status <> 'RECEIVED';
CREATE INDEX idx_order_list_entries_store_inventory_item ON order_list_entries(store_inventory_item_id);

ALTER TABLE store_inventory_items
    DROP CONSTRAINT fk_store_inventory_items_inventory_item,
    DROP COLUMN inventory_item_id;

DROP TABLE inventory_items;
