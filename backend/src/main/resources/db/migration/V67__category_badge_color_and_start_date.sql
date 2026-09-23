-- Badge color chosen in the Super Admin category form (drives the category's
-- icon tile color). Existing categories default to blue.
ALTER TABLE categories ADD COLUMN badge_color VARCHAR(16) NOT NULL DEFAULT 'blue';

-- Set when a category is created with "Enable Immediately" off: the category
-- only goes live from this date. Tasks in the category get their own
-- start_date clamped to it, which is what keeps them off today's checklist.
-- NULL means live from creation.
ALTER TABLE categories ADD COLUMN start_date DATE;
