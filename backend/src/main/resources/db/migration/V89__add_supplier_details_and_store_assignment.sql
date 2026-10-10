alter table suppliers add column contact varchar(20);
alter table suppliers add column location varchar(255);
alter table suppliers add column applies_to_all_stores boolean not null default false;

update suppliers set applies_to_all_stores = true;

create table supplier_stores (
    supplier_id bigint not null,
    store_id bigint not null,
    primary key (supplier_id, store_id)
);
alter table supplier_stores add constraint fk_supplier_stores_supplier
    foreign key (supplier_id) references suppliers on delete cascade;
alter table supplier_stores add constraint fk_supplier_stores_store
    foreign key (store_id) references stores;
