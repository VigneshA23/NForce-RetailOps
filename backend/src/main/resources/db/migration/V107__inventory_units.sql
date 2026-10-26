-- Units Super Admin adds beyond the built-in set (g, kg, ml, L, Nos.). Items
-- still store the unit as free text in store_inventory_items; this table only
-- feeds the unit dropdown and records whether the unit is countable
-- (whole_number) so every role validates quantities the same way.
CREATE TABLE inventory_units (
    id           BIGSERIAL PRIMARY KEY,
    name         VARCHAR(30) NOT NULL,
    whole_number BOOLEAN     NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_inventory_units_name ON inventory_units (LOWER(name));
