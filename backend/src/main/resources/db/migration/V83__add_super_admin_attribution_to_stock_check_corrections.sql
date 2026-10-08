-- A Super Admin correcting a historical stock check has no users row (see
-- V68's identical problem for raised_issues), so corrected_by_user_id can't
-- record them. Relax it to nullable and add a parallel Super Admin FK,
-- mirroring raised_issues.responded_by_super_admin_id -- exactly one of the
-- two is set per correction.
ALTER TABLE stock_check_corrections
    ALTER COLUMN corrected_by_user_id DROP NOT NULL,
    ADD COLUMN corrected_by_super_admin_id BIGINT REFERENCES super_admins(super_admin_id) ON DELETE SET NULL,
    ADD CONSTRAINT chk_stock_check_corrections_has_corrector
        CHECK (corrected_by_user_id IS NOT NULL OR corrected_by_super_admin_id IS NOT NULL);
