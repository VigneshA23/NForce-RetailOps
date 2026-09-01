create table store_code_counter (
    id integer primary key,
    next_value bigint not null
);

alter table stores add column store_code bigint;

update stores set store_code = 10000 + id where store_code is null;

alter table stores alter column store_code set not null;
alter table stores add constraint uq_stores_store_code unique (store_code);

insert into store_code_counter (id, next_value)
select 1, coalesce((select max(store_code) from stores), 10000) + 1;
