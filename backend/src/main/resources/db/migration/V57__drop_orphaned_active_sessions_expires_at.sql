-- expires_at was added directly against the shared dev database outside of
-- Flyway (no corresponding migration ever existed in this repo) and is not
-- mapped by the ActiveSession entity. Session expiry is computed in code from
-- last_active_at + the configurable inactivity timeout, so this column is
-- dead weight -- and being NOT NULL with no default, it was failing every
-- session insert (i.e. every login) with a not-null constraint violation.
ALTER TABLE active_sessions DROP COLUMN IF EXISTS expires_at;
