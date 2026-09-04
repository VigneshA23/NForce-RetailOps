create index if not exists idx_store_owners_user_id on store_owners (user_id);
create index if not exists idx_tasks_owner_id on tasks (owner_id);
create index if not exists idx_tasks_category_id on tasks (category_id);
create index if not exists idx_task_stores_store_id on task_stores (store_id);
