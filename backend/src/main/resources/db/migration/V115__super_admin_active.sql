-- Super Admin revocation (security audit VULN-10). super_admins had no
-- status column, so SuperAdminUserDetails.isEnabled() was hardcoded true and
-- a compromised Super Admin could only be cut off by a direct DB change.
-- Every existing Super Admin stays active.
ALTER TABLE super_admins
    ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
