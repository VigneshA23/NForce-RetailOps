-- An Owner/Admin correction can now fill in a snapshot that was never
-- recorded, which has no "original" value to carry -- original_count must be
-- nullable to represent that, distinct from an original value of 0.
ALTER TABLE stock_check_corrections ALTER COLUMN original_count DROP NOT NULL;
