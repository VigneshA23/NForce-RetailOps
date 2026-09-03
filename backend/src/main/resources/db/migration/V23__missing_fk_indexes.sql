-- Backs StoreOwnerRepository.findByOwnerId, hit by nearly every owner-scoped
-- request (EmployeeService, TaskService, ChecklistHistoryService,
-- OwnerManagementService). The unique constraint on owner_id was dropped in
-- V7 to allow multiple stores per owner, but no replacement index was added.
create index idx_store_owners_user_id on store_owners (user_id);

-- Backs TaskRepository.findActiveForStoreAndDate/findActiveForStoresAndDateRange
-- (owner_id predicate), the query behind the employee "today's checklist" and
-- the admin/employee history endpoints.
create index idx_tasks_owner_id on tasks (owner_id);

-- Backs Task.category joins/filters (t.category.active, t.category.displayOrder).
create index idx_tasks_category_id on tasks (category_id);

-- Composite PK on task_stores is (task_id, store_id), so a store_id-only
-- lookup can't lead with it efficiently.
create index idx_task_stores_store_id on task_stores (store_id);
