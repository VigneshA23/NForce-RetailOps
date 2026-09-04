-- IF NOT EXISTS: the column was already added to the shared Neon database by
-- an earlier, differently-numbered version of this migration (V24) whose
-- flyway_schema_history row was removed when the schema history was
-- renumbered/rebased for the incoming single-store-per-owner merge. Making
-- this idempotent means it's a no-op there, and a real column add anywhere
-- else (e.g. a fresh environment).
alter table super_admins add column if not exists phone TEXT;
