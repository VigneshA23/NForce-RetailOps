-- Preserves the store's most recently assigned owner even after
-- store_owners.user_id is cleared to null on release (owner deactivated, or
-- the store itself deactivated -- see OwnerManagementService.setOwnerActive /
-- StoreService.setStoreActive). Tasks and categories stay permanently keyed
-- to the owner who configured them, so without this an employee's daily
-- checklist went empty the moment their store became ownerless, even though
-- the same tasks were still sitting there, unclaimed by anyone new.
--
-- This column is a read-side fallback for the employee checklist only
-- (TaskService/MeHistoryService) and is never cleared once set. It plays no
-- part in the Super Admin's reassignment or "vacant store" surfaces, which
-- must keep treating a released store as ownerless -- those continue to key
-- off user_id/active/owner_vacant_since exactly as before.
alter table store_owners
    add column last_owner_id bigint references users(id) on delete set null;

update store_owners set last_owner_id = user_id where user_id is not null;
