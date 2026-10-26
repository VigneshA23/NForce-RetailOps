-- Optional note the admin leaves when approving or rejecting a stock receipt
-- request. Already applied to the shared dev DB; IF NOT EXISTS keeps this
-- safe on databases that have it and creates it on fresh ones.
ALTER TABLE stock_receipt_requests
    ADD COLUMN IF NOT EXISTS decision_note TEXT;
