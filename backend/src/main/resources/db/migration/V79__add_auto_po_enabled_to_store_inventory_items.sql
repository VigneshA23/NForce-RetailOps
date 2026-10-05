-- Owner-controlled "Auto PO Generator" switch (Inventory Items UI). When true
-- (the default, preserving today's behavior for every existing item),
-- StockCheckService.syncOrderList keeps auto-raising a NEEDS_ORDERING order
-- list entry whenever an End of Day stock check comes in short. Turning it
-- off for an item stops that automatic sync; the owner reorders it manually.
ALTER TABLE store_inventory_items ADD COLUMN auto_po_enabled BOOLEAN NOT NULL DEFAULT TRUE;
