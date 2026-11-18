-- Cash entry flags were Super Admin only (V119). Owner/Admins can flag too, and
-- the employee who entered the entry resolves the flag by correcting it, so the
-- flag and its history need a user as well as a super-admin actor.
--
-- Idempotent: every statement is safe to run twice.

-- Flagged by: an Owner/Admin (user) OR a Super Admin, never both.
ALTER TABLE daily_cash_entry_flags ALTER COLUMN flagged_by_super_admin_id DROP NOT NULL;
ALTER TABLE daily_cash_entry_flags ADD COLUMN IF NOT EXISTS flagged_by_user_id BIGINT REFERENCES users(id);
ALTER TABLE daily_cash_entry_flags DROP CONSTRAINT IF EXISTS chk_daily_cash_flags_flagged_by;
ALTER TABLE daily_cash_entry_flags ADD CONSTRAINT chk_daily_cash_flags_flagged_by CHECK (
    (flagged_by_user_id IS NULL) <> (flagged_by_super_admin_id IS NULL));

-- Resolved by: an admin removing it / correcting the entry, or the employee
-- who fixed it. `resolution` says which.
ALTER TABLE daily_cash_entry_flags ADD COLUMN IF NOT EXISTS resolved_by_user_id BIGINT REFERENCES users(id);
ALTER TABLE daily_cash_entry_flags ADD COLUMN IF NOT EXISTS resolution VARCHAR(20);
ALTER TABLE daily_cash_entry_flags DROP CONSTRAINT IF EXISTS chk_daily_cash_flags_resolved_pair;
ALTER TABLE daily_cash_entry_flags ADD CONSTRAINT chk_daily_cash_flags_resolved_pair CHECK (
    (resolved_at IS NULL) = (resolved_by_super_admin_id IS NULL AND resolved_by_user_id IS NULL)
    AND (resolved_by_super_admin_id IS NULL OR resolved_by_user_id IS NULL));

-- Rows resolved before this release were all by a Super Admin: removed, or
-- resolved by their own correction. The two cannot be told apart afterwards,
-- so they are recorded as REMOVED unless the history says otherwise.
UPDATE daily_cash_entry_flags f
SET resolution = CASE WHEN EXISTS (
        SELECT 1 FROM daily_cash_entry_flag_history h
        WHERE h.flag_id = f.id AND h.action = 'RESOLVED') THEN 'CORRECTED' ELSE 'REMOVED' END
WHERE f.resolved_at IS NOT NULL AND f.resolution IS NULL;

-- History actor: user or super admin.
ALTER TABLE daily_cash_entry_flag_history ALTER COLUMN actor_super_admin_id DROP NOT NULL;
ALTER TABLE daily_cash_entry_flag_history ADD COLUMN IF NOT EXISTS actor_user_id BIGINT REFERENCES users(id);
ALTER TABLE daily_cash_entry_flag_history DROP CONSTRAINT IF EXISTS chk_daily_cash_flag_history_actor;
ALTER TABLE daily_cash_entry_flag_history ADD CONSTRAINT chk_daily_cash_flag_history_actor CHECK (
    (actor_user_id IS NULL) <> (actor_super_admin_id IS NULL));

CREATE INDEX IF NOT EXISTS idx_daily_cash_entries_store_date
    ON daily_cash_entries(store_id, business_date);
