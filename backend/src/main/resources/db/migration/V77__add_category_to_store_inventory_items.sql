-- Re-introduces a category on each store's own inventory item (Phase 2 UI
-- redesign needs it for filtering/grouping and item icons). This is a plain
-- per-item string, unrelated to the old global inventory_categories table/
-- category_id column from before V70 -- those stay untouched and unused.
ALTER TABLE store_inventory_items
    ADD COLUMN category VARCHAR(40);
