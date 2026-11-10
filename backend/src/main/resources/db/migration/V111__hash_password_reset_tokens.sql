-- RTS-495: store only a SHA-256 hash of each password-reset / account-setup
-- token, never the token itself, so read access to this table can no longer
-- be turned into a working reset or invite link.
--
-- The hash is lowercase hex SHA-256 of the token's canonical UUID text, which
-- must match ResetTokenHashing.hash(UUID) byte for byte.

ALTER TABLE password_reset_tokens
    ADD COLUMN token_hash TEXT;

-- Links already emailed must keep working after release (invites last 72h),
-- so convert every still-redeemable token in place. Used or expired rows can
-- never be redeemed again, so they get no hash; they stay only because the
-- hourly request limit counts recent rows per email.
UPDATE password_reset_tokens
   SET token_hash = encode(sha256(convert_to(token::text, 'UTF8')), 'hex')
 WHERE used_at IS NULL
   AND expires_at > NOW();

-- Multiple NULLs are allowed (used/expired rows); a real hash is unique.
CREATE UNIQUE INDEX idx_prt_token_hash ON password_reset_tokens (token_hash);

-- The application no longer reads or writes the plaintext column. It is kept
-- for now so other branches sharing the dev database don't break, but it must
-- accept NULL for new rows, and every existing value is cleared so no usable
-- token remains readable. A follow-up migration drops the column and its index.
ALTER TABLE password_reset_tokens
    ALTER COLUMN token DROP NOT NULL;

UPDATE password_reset_tokens
   SET token = NULL;
