-- An Owner/Admin may now hold several stores at once (supersedes V27, which
-- allowed at most one active store per owner).
drop index if exists store_owners_user_id_active_key;

-- A store still has at most one active admin. store_owners.store_id is already
-- unique (one link row per store, reused on reassignment), so this partial
-- index is a belt-and-braces statement of the rule rather than a new limit:
-- existing data already satisfies it and no rows change.
create unique index if not exists store_owners_store_id_active_key
    on store_owners (store_id) where active = true;
