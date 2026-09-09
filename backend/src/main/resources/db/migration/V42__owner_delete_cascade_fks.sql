-- When a owner User record is hard-deleted by the Super Admin, cascade or
-- null-out all dependent FK columns so the single DELETE on users goes
-- through without FK violations.
--
-- store_owners: store survives (reassignable); owner reference cleared
ALTER TABLE store_owners DROP CONSTRAINT fk_store_owners_owner;
ALTER TABLE store_owners ADD CONSTRAINT fk_store_owners_owner
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- store_employees: employee survives; owner attribution cleared
ALTER TABLE store_employees DROP CONSTRAINT fk_store_employees_created_by_owner;
ALTER TABLE store_employees ADD CONSTRAINT fk_store_employees_created_by_owner
    FOREIGN KEY (created_by_owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- notifications: inbox belongs to the user; cascade-delete with them
ALTER TABLE notifications DROP CONSTRAINT fk_notifications_recipient;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_recipient
    FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- raised_issues: issue survives; responded_by attribution cleared
ALTER TABLE raised_issues DROP CONSTRAINT fk_raised_issues_responded_by;
ALTER TABLE raised_issues ADD CONSTRAINT fk_raised_issues_responded_by
    FOREIGN KEY (responded_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- admin_corrections: make corrected_by nullable so it can be cleared on delete
ALTER TABLE admin_corrections ALTER COLUMN corrected_by_user_id DROP NOT NULL;
ALTER TABLE admin_corrections DROP CONSTRAINT IF EXISTS admin_corrections_corrected_by_user_id_fkey;
ALTER TABLE admin_corrections ADD CONSTRAINT fk_admin_corrections_corrected_by
    FOREIGN KEY (corrected_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
