-- Snapshot of the item's preferred supplier when the day's stock check row is
-- created, so the EOD supplier report for a past date keeps showing the supplier
-- the item had then, even after the preferred supplier is changed.
ALTER TABLE stock_checks
    ADD COLUMN supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL;

-- Best available backfill: existing rows get the item's current preferred supplier.
UPDATE stock_checks sc
SET supplier_id = sii.preferred_supplier_id
FROM store_inventory_items sii
WHERE sii.id = sc.store_inventory_item_id;
