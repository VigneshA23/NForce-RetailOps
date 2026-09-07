-- Allow Super Admin to correct/flag responses.
-- Super Admin has no row in the users table, so corrected_by_user_id
-- must become nullable and a name text column carries their identity.
ALTER TABLE admin_corrections
    ALTER COLUMN corrected_by_user_id DROP NOT NULL;

ALTER TABLE admin_corrections
    ADD COLUMN corrected_by_name TEXT;
