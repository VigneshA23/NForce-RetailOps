-- Extend notifications table to support Super Admin recipients.
-- recipient_user_id becomes nullable (one of the two recipient columns must be non-null).
-- recipient_super_admin_id is the new column for SA-targeted notifications.
-- dedup_key prevents the scheduled jobs from creating duplicate alerts on the same day.

ALTER TABLE notifications
    ALTER COLUMN recipient_user_id DROP NOT NULL;

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS recipient_super_admin_id BIGINT
        REFERENCES super_admins(super_admin_id) ON DELETE CASCADE;

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(120);

ALTER TABLE notifications
    ADD CONSTRAINT chk_notifications_recipient
        CHECK (recipient_user_id IS NOT NULL OR recipient_super_admin_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_notifications_super_admin ON notifications(recipient_super_admin_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dedup ON notifications(recipient_super_admin_id, dedup_key)
    WHERE dedup_key IS NOT NULL;
