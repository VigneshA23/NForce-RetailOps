-- V6 added this column, but it is missing from the shared dev database (schema
-- drift outside of Flyway). Re-add it idempotently instead of editing V6.
alter table store_employees add column if not exists shift TEXT not null default 'Morning';
