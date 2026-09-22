-- Shifts are not fixed per employee -- the field never reflected real
-- scheduling and is being removed platform-wide (entity, DTOs, forms).
alter table store_employees drop column shift;
