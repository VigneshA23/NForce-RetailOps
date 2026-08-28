create table employee_stores (
    employee_id bigint not null,
    store_id bigint not null,
    primary key (employee_id, store_id)
);

alter table employee_stores
    add constraint fk_employee_stores_employee foreign key (employee_id) references store_employees on delete cascade;
alter table employee_stores
    add constraint fk_employee_stores_store foreign key (store_id) references stores on delete cascade;

create index idx_employee_stores_store_id on employee_stores (store_id);

insert into employee_stores (employee_id, store_id)
select id, store_id from store_employees;

alter table store_employees drop constraint fk_store_employees_store;
alter table store_employees drop column store_id;
