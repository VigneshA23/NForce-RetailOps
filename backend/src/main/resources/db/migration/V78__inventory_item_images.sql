-- Display image for a store inventory item, picked from Unsplash search
-- results by Super Admin or the store's Owner/Admin and copied into the
-- database (not hotlinked). Kept in its own table so list queries on
-- store_inventory_items never drag the bytes along, and so each picked
-- image gets a fresh, immutable id the frontend can cache by.
CREATE TABLE inventory_item_images (
    id                 BIGSERIAL     PRIMARY KEY,
    content_type       VARCHAR(100)  NOT NULL,
    data               BYTEA         NOT NULL,
    unsplash_photo_id  VARCHAR(64),
    photographer_name  TEXT,
    photographer_url   TEXT,
    created_at         TIMESTAMPTZ   NOT NULL
);

ALTER TABLE store_inventory_items
    ADD COLUMN image_id BIGINT REFERENCES inventory_item_images (id) ON DELETE SET NULL;
