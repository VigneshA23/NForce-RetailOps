-- Inventory items no longer carry a category (the app stopped reading or
-- writing store_inventory_items.category_id). The column, its FK and the
-- inventory_categories table are left in place so existing values survive
-- if categories are reintroduced later; only the NOT NULL is lifted so new
-- items can be inserted without one.

ALTER TABLE store_inventory_items
    ALTER COLUMN category_id DROP NOT NULL;
