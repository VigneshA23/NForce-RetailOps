alter table store_owners add column active boolean not null default true;

-- Existing rows may have stores.active = false representing "this owner's
-- access was revoked" under the previous (incorrect) implementation, which
-- wrongly closed the store record itself instead of just the owner's link to
-- it. Migrate that intent onto the new owner-link-scoped flag, then restore
-- the store record to available -- store-level closure is a separate,
-- not-yet-built feature.
update store_owners so
set active = false
from stores s
where s.id = so.store_id and s.active = false;

update stores set active = true where active = false;
