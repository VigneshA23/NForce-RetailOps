alter table store_employees add column phone TEXT not null default '';
alter table store_employees add column shift TEXT not null default 'Morning';
alter table store_employees add column employee_type TEXT not null default 'Full Time';
alter table store_employees add column gender TEXT not null default 'Male';
