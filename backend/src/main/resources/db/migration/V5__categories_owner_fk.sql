alter table categories drop constraint fk_categories_store;
alter table categories drop constraint uq_categories_store_name;
alter table categories drop column store_id;

alter table categories add column owner_id bigint not null;
alter table categories add constraint fk_categories_owner foreign key (owner_id) references users;
alter table categories add constraint uq_categories_owner_name unique (owner_id, name);
