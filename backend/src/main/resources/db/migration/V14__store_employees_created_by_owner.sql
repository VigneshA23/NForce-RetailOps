alter table store_employees add column created_by_owner_id bigint;

alter table store_employees
    add constraint fk_store_employees_created_by_owner foreign key (created_by_owner_id) references users;

create index idx_store_employees_created_by_owner_id on store_employees (created_by_owner_id);

update store_employees se
set created_by_owner_id = (
    select so.user_id
    from employee_stores es
    join store_owners so on so.store_id = es.store_id
    where es.employee_id = se.id
    order by so.id
    limit 1
)
where se.created_by_owner_id is null;
