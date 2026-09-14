# Category store assignment & Super Admin parity — design

## Goal

Extend checklist `Category` management so that:

- Super Admin can create/edit/activate-deactivate categories and assign them to **All Stores** or specific stores, across the whole platform.
- Owner Admin retains the same category management capability, scoped to the store(s) they own.
- Categories are **shared data**: a category created or edited by an Owner Admin is visible to Super Admin, and vice versa — not a sync/mirror, the same underlying rows viewed through role-scoped filters.

## Current state (before this change)

- `Category` is scoped to a single owner via a non-null `owner_id` FK (`categories` table, `V5__categories_owner_fk.sql`). No store concept exists on it at all.
- `CategoryController` is class-level `@PreAuthorize("hasRole('OWNER_ADMIN')")` — Super Admin has no access.
- Activate/deactivate (`active` boolean) already exists and already cascades to deactivate the category's `Task`s.
- The precedent for "assign to specific stores or all stores" already exists on `Task`: an `applies_to_all_stores` boolean column plus a `task_stores` many-to-many join table, validated in `TaskService.resolveStores()` against the acting owner's stores via `StoreOwnerRepository`, using `InvalidStoreSelectionException` / `StoreInactiveException` (both already defined and mapped in `GlobalExceptionHandler`).

## Data model & migration

New Flyway migration `V{n}__category_store_assignment.sql`:

- `alter table categories alter column owner_id drop not null;` — `owner_id` keeps its existing meaning ("the Owner Admin who created this category") but becomes optional; `NULL` means the row was created by Super Admin. It is no longer used to scope *visibility*, only to interpret the "All Stores" flag below.
- `alter table categories add column applies_to_all_stores boolean not null default false;`
- New join table, shaped identically to `task_stores`:
  ```sql
  create table category_stores (
      category_id bigint not null,
      store_id bigint not null,
      primary key (category_id, store_id)
  );
  alter table category_stores add constraint fk_category_stores_category
      foreign key (category_id) references categories on delete cascade;
  alter table category_stores add constraint fk_category_stores_store
      foreign key (store_id) references stores;
  ```
- Backfill: `update categories set applies_to_all_stores = true;` — every existing row already has a non-null `owner_id`, so this reproduces current behavior exactly (visible only to that owner, across whichever store(s) they own) with no visible change to existing data.

**"All Stores" is relative to who set it:**
- `owner_id` set (Owner-Admin-created) → "all stores this owner has."
- `owner_id` is `NULL` (Super-Admin-created) → literally every store on the platform.

## Backend API & service logic

### Visibility (`listCategories`)

- **Super Admin**: every category, no filter.
- **Owner Admin (id X)**: a category is visible if any of:
  1. `category_stores` includes a store X owns, OR
  2. `applies_to_all_stores = true` AND `owner_id = X`, OR
  3. `applies_to_all_stores = true` AND `owner_id IS NULL` (a Super-Admin-created global category).

### Create / update store assignment

- **Super Admin**: full replace. Can set `appliesToAllStores = true` (global, clears `category_stores`, `owner_id` stays/becomes `NULL`) or an explicit `storeIds` list drawn from *any* store platform-wide.
- **Owner Admin**: can only pick from stores they own (validated via `StoreOwnerRepository`, same pattern as `TaskService.resolveStores`). Saving **merges**: it only adds/removes *their own* rows in `category_stores` for that category, leaving any other owner's rows untouched. An Owner Admin cannot toggle a Super-Admin-created global category (`applies_to_all_stores = true`, `owner_id IS NULL`) — there is no store-specific row for them to merge into, so that control is read-only for them.

### Name uniqueness (unique per store)

On create/rename: find existing categories with the same name (case-insensitive), resolve each one's *effective* store-id set (expanding `applies_to_all_stores` against the real store list for its context), and reject only if that set overlaps the new/edited category's effective store-id set. Reuses `CategoryNameExistsException`.

### Delete

- Super Admin: always a hard delete.
- Owner Admin: hard delete only if every store on the category belongs to them. If the category also spans another owner's store, the "delete" action instead removes just their own stores from it (falls back to the store-editing merge path above) rather than deleting the row.

### Notifications

The existing create-time notification (today: employees of "the owner's one active store," via `storeOwnerRepository.findByOwnerIdAndActiveTrue`) extends to notify employees of every store actually assigned to the new category (or all stores, if global).

## Security / role access

- `CategoryController`'s class-level `@PreAuthorize("hasRole('OWNER_ADMIN')")` → `@PreAuthorize("hasAnyRole('OWNER_ADMIN','SUPER_ADMIN')")`.
- Each method resolves the actor's role from the JWT principal and branches accordingly: `SUPER_ADMIN` → no owner filter, full store universe for store-selection validation; `OWNER_ADMIN` → existing owner-scoped behavior extended with the store-overlap rules above.
- `CategoryRequest` gains `boolean appliesToAllStores` + `List<Long> storeIds` (mirrors `TaskRequest`). `CategoryResponse` gains a resolved store summary — `appliesToAllStores` plus a `List<StoreSummary>` (id + name) — so both UIs can render "All Stores" vs. an explicit store-name list.
- Reuses existing `InvalidStoreSelectionException` / `StoreInactiveException` for invalid store picks (already defined and handled from the Task feature).

## Frontend UI

- `frontend/src/types/category.ts`: `Category` gains `appliesToAllStores: boolean` and `stores: { id: number; name: string }[]`.
- `frontend/src/api/categories.ts`: create/update payloads carry `appliesToAllStores` / `storeIds`; existing `parseErrorMessage` pattern unchanged.
- **Owner Admin** (`Categories.tsx`, `CategoryFormModal.tsx`, `CategoryTable.tsx`): form gains a store picker (checkbox list of the owner's own stores + an "All Stores" option, matching `TaskFormModal`'s interaction pattern); table gains a "Stores" column showing resolved names or "All Stores." Delete button reads "Remove my stores" instead of "Delete" when the category spans another owner's store(s), per the Delete rule above.
- **Super Admin (new)**: new `SuperAdminCategories.tsx` page added to `SuperAdminDashboard`'s existing tab set, reusing `CategoryTable` / `CategoryFormModal` (parameterized by role) rather than duplicating them; its store picker lists all platform stores, grouped by owner. New `useSuperAdminCategories` hook mirrors `useOwnerCategories`.

## Out of scope

- `CategoryInactiveException` remains unused (already defined/mapped, not exercised by this feature — no requirement to block task creation on an inactive category here).
- No changes to how `Category.active` cascades to `Task.active` — unchanged.
- No changes to the unrelated `InventoryCategory` (SuperAdmin inventory taxonomy) entity/feature.
