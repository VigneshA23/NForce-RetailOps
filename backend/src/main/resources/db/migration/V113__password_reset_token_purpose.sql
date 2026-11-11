-- RTS-512: record what each token is for, so resending an account-setup link can
-- retire earlier setup links without touching a pending password-reset link.
--
-- NOT NULL DEFAULT keeps older branches that still insert without this column
-- working (their rows are labelled PASSWORD_RESET).
ALTER TABLE password_reset_tokens
    ADD COLUMN purpose TEXT NOT NULL DEFAULT 'PASSWORD_RESET';

-- Existing rows: setup links live 72h, reset links 1h (PasswordResetService).
UPDATE password_reset_tokens
   SET purpose = 'ACCOUNT_SETUP'
 WHERE expires_at - created_at > INTERVAL '2 hours';
