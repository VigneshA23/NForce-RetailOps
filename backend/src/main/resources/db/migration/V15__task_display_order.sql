alter table tasks add column display_order integer not null default 0;

update tasks t
set display_order = sub.rn - 1
from (
    select id, row_number() over (partition by category_id order by created_at asc, id asc) as rn
    from tasks
) sub
where t.id = sub.id;
