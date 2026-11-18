-- Release reset: every existing store starts from the same cash-drawer target,
-- $100.00, overwriting any custom target. The target stays in
-- store_cash_targets (one row per store, V109) rather than a stores column, so
-- the owner's Cash Target page, the Super Admin store forms and the
-- expected-cash/variance code keep reading the same place.
--
-- Safe to run more than once: the backup is only taken the first time (so it
-- always holds the pre-reset values), the update always lands on 100.00, and a
-- store gets a row only if it has none.

-- One-way change, so keep the previous targets first.
CREATE TABLE IF NOT EXISTS store_cash_targets_backup_v117 AS
    SELECT * FROM store_cash_targets;

-- The old values are not written to store_cash_target_changes: that trail
-- requires a named actor (an Owner/Admin or a Super Admin), and this is a
-- platform reset. The backup table above is the record of what they were.
-- The "last changed by" columns are cleared, so each store reads as being on
-- the platform default until someone sets its target.
UPDATE store_cash_targets
SET target_amount = 100.00,
    updated_by_user_id = NULL,
    updated_by_super_admin_id = NULL,
    updated_at = now()
WHERE target_amount <> 100.00
   OR updated_by_user_id IS NOT NULL
   OR updated_by_super_admin_id IS NOT NULL;

INSERT INTO store_cash_targets (store_id, target_amount)
SELECT s.id, 100.00
FROM stores s
WHERE NOT EXISTS (SELECT 1 FROM store_cash_targets t WHERE t.store_id = s.id);

-- A row created later without an explicit amount (a store added through the
-- owner flows, which have no target field) also starts at 100.00, not V109's 150.00.
ALTER TABLE store_cash_targets ALTER COLUMN target_amount SET DEFAULT 100.00;
