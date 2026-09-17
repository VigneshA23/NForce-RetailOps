-- Tracks when a store's StoreOwner link most recently lost its active owner
-- (Super Admin deactivating the Owner/Admin, or revoking their access to this
-- store), so a scheduled job can notify the Super Admin if the store is still
-- ownerless 24 hours later. Cleared back to null as soon as the store gets an
-- active owner again (reassignment or reactivation of the link).
alter table store_owners
    add column owner_vacant_since timestamptz;
