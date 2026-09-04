-- A Store can now exist with no owner at all (Super Admin can create a store
-- up front and hand it to an owner later), represented as a store_owners row
-- with user_id = null and active = false -- the same "available for
-- reassignment" shape already used for a revoked owner's old store.
alter table store_owners alter column user_id drop not null;
