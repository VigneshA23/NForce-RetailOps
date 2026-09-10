-- user_roles' PK is (role_id, user_id), so a user_id-only lookup (every login,
-- via UserRepository.findByEmailWithRoles) can't use it as an index.
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Notifications: the 60s-polled unread-count queries filter by
-- (recipient, read = false); the existing single-column recipient indexes don't
-- cover the read-status filter.
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_user_id, read)
    WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_super_admin_unread ON notifications(recipient_super_admin_id, read)
    WHERE read = false;
