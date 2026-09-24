-- A Super Admin can acknowledge/resolve an issue on a store's behalf, but
-- Super Admins live in their own identity table (not users), so
-- responded_by_user_id can't record them. Track that responder separately so
-- the employee/owner can see who actually responded.
ALTER TABLE raised_issues
    ADD COLUMN IF NOT EXISTS responded_by_super_admin_id BIGINT
        REFERENCES super_admins(super_admin_id) ON DELETE SET NULL;
