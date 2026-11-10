-- Sessions were keyed on bare email, so a users row and a super_admins row
-- sharing an email string could revoke each other's sessions. Scope every
-- session to the principal table its subject lives in.
ALTER TABLE active_sessions
    ADD COLUMN principal_type VARCHAR(20) NOT NULL DEFAULT 'USER';

UPDATE active_sessions
   SET principal_type = 'SUPER_ADMIN'
 WHERE lower(subject_email) IN (SELECT lower(email) FROM super_admins);

ALTER TABLE active_sessions
    ADD CONSTRAINT chk_active_sessions_principal_type
    CHECK (principal_type IN ('USER', 'SUPER_ADMIN'));

CREATE INDEX idx_active_sessions_principal_email
    ON active_sessions (principal_type, subject_email);
