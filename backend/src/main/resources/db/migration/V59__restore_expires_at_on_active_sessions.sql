-- This branch's ActiveSession entity still maps expires_at (added in V55), but
-- the shared dev database also picked up a later migration (from another
-- branch, not present here) that dropped it again. Restoring it here so
-- Hibernate schema validation matches what this branch's code expects --
-- idempotent so it's a no-op wherever the column is already present.
alter table active_sessions add column if not exists expires_at timestamp(6) with time zone;

update active_sessions set expires_at = last_active_at + interval '30 minutes' where expires_at is null;

alter table active_sessions alter column expires_at set not null;
