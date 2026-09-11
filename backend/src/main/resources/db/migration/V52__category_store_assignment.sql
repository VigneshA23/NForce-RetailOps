alter table categories alter column owner_id drop not null;
alter table categories add column applies_to_all_stores boolean not null default false;

update categories set applies_to_all_stores = true;

create table category_stores (
    category_id bigint not null,
    store_id bigint not null,
    primary key (category_id, store_id)
);
alter table category_stores add constraint fk_category_stores_category
    foreign key (category_id) references categories on delete cascade;
alter table category_stores add constraint fk_category_stores_store
    foreign key (store_id) references stores;
