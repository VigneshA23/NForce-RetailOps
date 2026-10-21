-- A request that holds a count back until the admin decides (a lower Start of
-- Day, or a restock whose count isn't trustworthy until approved) stashes the
-- submitted available/dead stock here instead of writing them to stock_checks.
-- holds_snapshot marks which request of a submission (there can be several,
-- e.g. two deliveries reported together) is the one whose approval applies
-- the count; the others remain delivery-only as before.
ALTER TABLE stock_receipt_requests
    ADD COLUMN pending_available  NUMERIC(12,2),
    ADD COLUMN pending_dead_stock NUMERIC(12,2),
    ADD COLUMN holds_snapshot     BOOLEAN NOT NULL DEFAULT false;
