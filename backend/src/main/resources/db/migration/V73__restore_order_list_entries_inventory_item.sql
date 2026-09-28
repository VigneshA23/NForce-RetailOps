-- Same uncommitted redesign that dropped inventory_items (restored in V72) also
-- swapped order_list_entries.inventory_item_id for store_inventory_item_id.
-- OrderListEntry still maps inventory_item_id directly (deliberately, per its
-- class comment, so an order survives a later store-assignment deactivation),
-- and OrderListService.addOrUpdateEntry relies on a unique-violation on
-- (store_id, inventory_item_id) while status <> 'RECEIVED' to resolve a
-- check-then-act race -- restore both the column and that index.
ALTER TABLE order_list_entries
    ADD COLUMN inventory_item_id BIGINT;

UPDATE order_list_entries ole
SET inventory_item_id = sii.inventory_item_id
FROM store_inventory_items sii
WHERE sii.id = ole.store_inventory_item_id;

ALTER TABLE order_list_entries
    ALTER COLUMN inventory_item_id SET NOT NULL;

ALTER TABLE order_list_entries
    ADD CONSTRAINT fk_order_list_entries_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id);

CREATE UNIQUE INDEX uq_order_list_entries_active_item ON order_list_entries(store_id, inventory_item_id) WHERE status <> 'RECEIVED';
