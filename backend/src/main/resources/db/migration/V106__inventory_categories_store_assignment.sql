-- Resurrects the dormant inventory_categories table (V45, unused since V75
-- dropped its NOT NULL requirement) for Super Admin-managed inventory
-- categories: the same appliesToAllStores + join-table pattern already used
-- by suppliers (V89) and task categories (V52), including the same
-- backfill -- any category predating this field keeps its original
-- "usable by any store" behavior.
ALTER TABLE inventory_categories
    ADD COLUMN applies_to_all_stores BOOLEAN NOT NULL DEFAULT false;

UPDATE inventory_categories SET applies_to_all_stores = true;

CREATE TABLE inventory_category_stores (
    category_id BIGINT NOT NULL,
    store_id    BIGINT NOT NULL,
    PRIMARY KEY (category_id, store_id)
);
ALTER TABLE inventory_category_stores ADD CONSTRAINT fk_inventory_category_stores_category
    FOREIGN KEY (category_id) REFERENCES inventory_categories ON DELETE CASCADE;
ALTER TABLE inventory_category_stores ADD CONSTRAINT fk_inventory_category_stores_store
    FOREIGN KEY (store_id) REFERENCES stores;
