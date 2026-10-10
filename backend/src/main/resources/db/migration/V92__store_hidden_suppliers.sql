create table store_hidden_suppliers (
    store_id bigint not null,
    supplier_id bigint not null,
    primary key (store_id, supplier_id)
);
alter table store_hidden_suppliers add constraint fk_store_hidden_suppliers_store
    foreign key (store_id) references stores on delete cascade;
alter table store_hidden_suppliers add constraint fk_store_hidden_suppliers_supplier
    foreign key (supplier_id) references suppliers on delete cascade;
