-- V62 re-added this column to undo what looked like schema drift, before it
-- was clear that V61 dropping it was an intentional, whole-stack removal
-- (shifts are not fixed per employee -- see V61's commit). Drop it again so
-- the shared dev database matches the entity, which no longer maps it.
alter table store_employees drop column if exists shift;
