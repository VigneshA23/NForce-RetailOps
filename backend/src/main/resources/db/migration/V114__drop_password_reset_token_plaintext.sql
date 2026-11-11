-- RTS-510: remove the plaintext token column RTS-495 (V111) stopped using.
-- V111 already NULLed every value, and the application reads/writes only
-- token_hash, so no working link depends on this column or its index.
DROP INDEX IF EXISTS idx_prt_token;

ALTER TABLE password_reset_tokens
    DROP COLUMN IF EXISTS token;
