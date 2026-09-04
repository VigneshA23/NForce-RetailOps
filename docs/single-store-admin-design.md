# Single-Store Admin Design

**Branch:** vigneshdev  
**Date:** 2026-09-03  
**Status:** Design only — no code or migrations written

---

## Summary & Recommendation

**The goal:** Admin (OWNER_ADMIN role) is assigned to exactly one store. Super Admin retains full multi-store visibility and management across the whole platform.

**The bottom line — read this first:**

The database schema already enforces one-store-per-admin at the `store_owners` table level (`store_id` has a `UNIQUE` constraint), meaning each store can only have one owner. The V7 migration (`allow_multiple_stores_per_owner`) dropped the constraint in the opposite direction — it removed `UNIQUE` on `user_id` (the owner column), allowing one owner to be linked to many stores.

**The live database has a blocking problem:** `owner@nforceone.com` (Praveen Kumar) currently has **3 stores** assigned. Before any schema change, this must be resolved manually — deciding which single store they keep.

**Recommended approach:** Enforce single-store-per-admin at the **application layer only** (not a schema change). Add a `UNIQUE` constraint on `user_id` back in a new Flyway migration — but only after resolving the multi-store owner in the data. This is the minimal-risk, fully-reversible path.

The frontend needs the larger changes: remove the `Stores` management list page from Admin's nav, simplify Store Detail so it auto-selects the Admin's single store with no picker dropdown, remove the store-selector from History, update the Home dashboard. The backend needs almost no changes — most controllers already scope by `ownerId` without caring about store count.

---

## Part 1 — Skills Inventory

Checked: `/mnt/skills/public/`, `/mnt/skills/private/`, `/mnt/skills/examples/`, `/mnt/skills/user/`

**Result:** All four paths returned `NOT FOUND`. No skill directories are mounted in this environment. The `frontend-design` skill referenced in the task prompt is loaded via a different mechanism (Claude Code session skills), not a file-based skill directory. No "find skill" tool is available.

**Applied skills:** The `frontend-design` skill was loaded earlier in this session and informs the UI recommendations in Parts 5 and 6.

---

## Part 2 — Current State Map

### 2a. Database Relationship (Store ↔ Admin)

**Migration history:**

| Migration | What it did |
|-----------|-------------|
| V1 | Created `stores` table |
| V3 | Created `store_owners` join table with `store_id UNIQUE` AND `owner_id UNIQUE` — effectively one-to-one |
| V7 | `ALTER TABLE store_owners DROP CONSTRAINT store_owners_owner_id_key` — dropped uniqueness on the owner column, enabling one owner → many stores |
| V8 | Renamed `owner_id` column to `user_id` |

**Current `store_owners` schema (live DB):**

```
Column     | Type    | Constraints
-----------|---------|---------------------------
id         | bigint  | PK, identity
store_id   | bigint  | NOT NULL, UNIQUE FK → stores
user_id    | bigint  | NOT NULL, FK → users (NO unique constraint)
created_at | timestamptz | NOT NULL
active     | boolean | NOT NULL, DEFAULT true
```

**Conclusion:** Today the relationship is **one-to-many (one admin → many stores)** at the DB level. Each store still has at most one owner (`store_id UNIQUE` is intact), but an owner can appear in multiple `store_owners` rows. V7 deliberately enabled this.

**Java entity mapping:**

```java
// StoreOwner.java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "user_id", nullable = false)
private User owner;    // Many store_owners rows → same User

@OneToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "store_id", nullable = false, unique = true)
private Store store;   // Each store_owner has exactly one Store
```

The entity's own annotation says `@ManyToOne` for the owner — the Java model already models multi-store-per-admin.

---

### 2b. Controller/Service Store-Scoping Analysis

**CategoryController / CategoryService**

- All methods pass `principal.getUser().getId()` as `ownerId`.
- `CategoryService` scopes by `ownerId` only — no `storeId` involved at all.
- Categories belong to the owner, not to individual stores.
- **No multi-store assumption.** Zero changes needed for single-store-per-admin.

**TaskController / TaskService**

- All owner-facing methods pass `ownerId` only.
- `listTasks(ownerId)` fetches all tasks owned by this admin.
- `createTask` / `updateTask` call `resolveStores(ownerId, request)` which validates submitted `storeIds` against `storeOwnerRepository.findByOwnerIdAndStoreIdIn(ownerId, storeIds)` — a list check because tasks can be assigned to "specific stores" or "all stores."
- With a single store, `resolveStores` still works: the admin would always select their one store (or choose "applies to all stores").
- **Mild multi-store assumption in `resolveStores`:** it returns a `Set<Store>` and validates a submitted list of store IDs. Under single-store-per-admin, the admin will always have exactly one store to select. The logic is still correct — it just becomes trivial (list of 0 or 1). No backend change is strictly required, though the task creation form's store-selector UI will simplify.

**EmployeeController / EmployeeService**

- `listEmployees(ownerId)`: fetches all stores the owner has, finds employees across all of them, then also adds employees created by this owner regardless of store. Returns a merged list.
- `listAssignableStores(ownerId)`: returns all stores the owner manages — used to populate the "assign to store" dropdown when creating/editing an employee.
- `resolveOwnerStores(ownerId, storeIds)`: validates each submitted store ID against ownership, same pattern as `resolveStores` in TaskService.
- **Multi-store assumption in list logic:** `listEmployees` deliberately unions employees across all owned stores. Under single-store, this naturally returns employees of the one store — no change needed, it still works correctly.
- **`listAssignableStores` returns a list** — with one store it returns a list of one. The employee form's store dropdown will show one option. Works correctly, just becomes simpler visually.

**StoreController / StoreService**

- `list(ownerId)`: `storeOwnerRepository.findByOwnerId(ownerId)` returns all stores for this admin. Currently returns a list; shows a Stores management page.
- `renameStore(ownerId, storeId, request)`: Admin can rename any of their stores.
- `deleteStore(ownerId, storeId)`: Admin can delete any of their stores.
- **Strong multi-store assumption.** The entire StoreController exists to manage a LIST of stores. Under single-store-per-admin, an Admin should not have a Stores management page at all — the Super Admin owns store creation and deletion. This controller's rename/delete endpoints become unnecessary for the Admin role. They should either be restricted to Super Admin only or removed.

**ChecklistHistoryController / ChecklistHistoryService**

- Not shown above, but used by `History.tsx` and `StoreDetail.tsx`.
- `getChecklistHistorySummary` takes a `storeIds` list parameter — the frontend already sends the admin's owned store IDs.
- Under single-store, this becomes a list of one. Backend unchanged.

---

### 2c. SuperAdminController — Store Assignment to Owners

**Current flow:**

1. `POST /api/addowners` → `OwnerManagementService.addOwner(request)` → `OwnerProvisioningService.createOwnerAccount(...)`.
   - `AddOwnerRequest` accepts `storeName + storeLocation` (create new store) OR `existingStoreId` (reassign an inactive store).
   - Both paths create exactly one `StoreOwner` link.
   - **No multi-store enforcement here** — a single `addOwner` call creates one store link.

2. `POST /api/owners/{ownerId}/stores` → `OwnerManagementService.assignStore(ownerId, request)`.
   - Creates a **new store** and links it to an existing owner.
   - This is how an owner can end up with multiple stores today — Super Admin calls this endpoint repeatedly for the same owner.
   - **This endpoint is the source of the problem.** Under the new model, it should be blocked or removed (Super Admin should not be able to assign additional stores to an already-store-owning admin).

**Can Super Admin currently assign multiple stores to one owner?** Yes. The `POST /api/owners/{ownerId}/stores` endpoint has no guard preventing it from being called multiple times for the same owner.

---

### 2d. Frontend — Admin Store UI

**Stores.tsx:** Full store management list page. Shows all of the admin's stores, lets them rename (via `StoreFormModal`). This is a dedicated nav tab ("store-management"). **Assumes multi-store.**

**StoreDetail.tsx:** Shows a store picker `<select>` at the top when the admin has multiple stores. Fetches `getStores()` independently (its own local state, not shared from `DashboardShell`'s `useOwnerStores`). With a single store it still works — the dropdown shows one option and auto-selects it — but the picker UI becomes redundant noise.

**Categories.tsx:** No store selector. Categories are owner-scoped, not store-scoped. **Already single-store-safe.**

**Tasks.tsx:** Receives `stores` as a prop (from `DashboardShell` via `useOwnerStores`). Passes them to `TaskFormModal` for the store-assignment picker when creating/editing a task. The filter bar also has a "All Stores" dropdown. With one store: the form picker shows one store, the filter dropdown shows one store. Works, but the store filter in the list and the "specific stores" picker in the form become less meaningful when there's always exactly one option.

**History.tsx:** Has a multi-select "Search and select stores" picker (`SearchableSelect`) plus "All Stores" toggle. With one store: works, but unnecessary complexity. Under single-store-per-admin, History can auto-scope to the one store with no picker shown.

**DashboardShell.tsx navigation:** `OWNER_NAV_ITEMS` includes both `store-detail` and `store-management` as separate nav tabs. Under single-store-per-admin, `store-management` (the Stores list page) should be removed from the Admin nav.

**Home.tsx:** Shows "Total Stores" stat card, a "Stores by Completion" chart that ranks multiple stores, and iterates over `storeIds` to fetch history per store. With one store: all of this still works — it just shows one store everywhere. The "Stores by Completion" chart becomes a single-entry list.

---

### 2e. Current State Summary Table

| Area | Current assumption | Single-store-ready? | Change required? |
|------|-------------------|---------------------|-----------------|
| `store_owners` schema | Multi-store (`user_id` not unique) | No | New migration: add `UNIQUE` on `user_id` |
| `StoreOwner` entity `@ManyToOne` | Multi-store | No | Change to `@OneToOne` (after migration) |
| `StoreOwnerRepository.findByOwnerId` | Returns list | No | Add `findByUserId` returning `Optional` |
| `CategoryController/Service` | Owner-scoped, no store | Yes | None |
| `TaskController/Service` | Owner-scoped; store list in create/update | Effectively yes | Minor: UI simplification in form |
| `EmployeeController/Service` | Multi-store union in list | Effectively yes | None (works with 1 store) |
| `StoreController/Service` | Multi-store management list | No | Restrict/remove rename + delete from Admin |
| `SuperAdminController.assignStore` | Unrestricted repeat calls | No | Add guard: block if owner already has active store |
| `OwnerManagementService.listOwners` | Returns one row per store-owner link | No | Simplify: one row per owner (after single-store) |
| `DashboardShell` nav | Has "Stores" + "Store Detail" tabs | No | Remove "Stores" tab |
| `Stores.tsx` | Full list management page | No | Remove or Super Admin-only |
| `StoreDetail.tsx` | Store picker dropdown | No | Auto-select single store, remove picker |
| `History.tsx` | Multi-store filter/picker | No | Auto-scope to single store, remove picker |
| `Tasks.tsx` (store filter) | Store dropdown filter | Effectively yes | Simplify or remove store filter |
| `Home.tsx` | Multi-store charts/stats | Effectively yes | Minor: rename "Total Stores" stat |
| `SuperAdminDashboard.tsx` | Owner list with multi-store rows | No | Simplify OwnerResponse model |

---

## Part 3 — Data Safety Check (Read-Only)

Query run against the live Neon database:

```sql
SELECT 
    u.full_name AS owner_name,
    u.email AS owner_email,
    COUNT(so.id) AS store_count,
    STRING_AGG(s.name, ', ' ORDER BY s.name) AS store_names
FROM store_owners so
JOIN users u ON u.id = so.user_id
JOIN stores s ON s.id = so.store_id
GROUP BY u.id, u.full_name, u.email
ORDER BY store_count DESC, u.full_name;
```

**Result:**

| owner_name | owner_email | store_count | store_names |
|------------|-------------|-------------|-------------|
| Praveen Kumar | owner@nforceone.com | **3** | Downtown - Store 1, River way - Store 2, Scoopshire |
| Test owner added | owner12@nforceone.com | 1 | Popsicles |
| Test owner email | maheshwar.mettupally@nforceone.com | 1 | Popsicles |

> **⚠️ BLOCKING ISSUE:** `Praveen Kumar` (`owner@nforceone.com`) has **3 stores assigned**. The schema constraint (`UNIQUE` on `user_id`) cannot be added while this exists. Before any migration runs, you must decide which single store this admin keeps — and reassign the other two stores' ownership (deactivate those `store_owners` rows, leaving the stores available for reassignment to new owners, or delete them if unused).

The two test owners (owner12, maheshwar) each have 1 store — no conflict there.

---

## Part 4 — Proposed New Data Model

### Recommendation: Application-layer enforcement + a new UNIQUE constraint migration

**Not** restructuring the table (no column moves, no join table removal). Instead:

1. **Resolve the data conflict** (manually, before migration): deactivate or remove the two extra `store_owners` rows for Praveen Kumar so only one remains.
2. **Add a new Flyway migration** (V27) that adds `UNIQUE` on `store_owners.user_id`.
3. **Update the Java entity** from `@ManyToOne` to `@OneToOne` on `StoreOwner.owner`.
4. **Update `StoreOwnerRepository`** to replace `findByOwnerId(Long)` (returns `List`) with `findByUserId(Long)` (returns `Optional<StoreOwner>`) everywhere the Admin context is resolved.

**Why not a full table restructure?**

- The current `store_owners` join table shape (`id`, `store_id`, `user_id`, `active`, `created_at`) is already clean and correctly normalized. There's no benefit to moving a FK column onto the `stores` table — it would require changing every query that joins through `store_owners`.
- The join table enables the `active` flag per store-owner relationship (whether the admin still has access to this store) — a useful concept that disappears if you embed ownership directly in `stores`.
- Reversibility: dropping a `UNIQUE` constraint is a single DDL statement. Reversing a column migration across two tables is much harder.

**Why application-layer enforcement alongside the DB constraint?**

The constraint catches honest mistakes at the DB level. The application layer (the `assignStore` endpoint guard) catches it with a clean user-facing error message instead of a raw 409.

### Conceptual migration V27

```
-- V27__enforce_single_store_per_owner.sql (description only — not written yet)
-- Precondition: no user_id appears more than once in store_owners.
-- Adds a UNIQUE constraint on user_id, mirroring the original V3 schema intent.
ALTER TABLE store_owners ADD CONSTRAINT store_owners_user_id_key UNIQUE (user_id);
```

This is the ENTIRE migration. One line. Trivially reversible.

---

## Part 5 — Feature Responsibility Recommendations

### 5a. Should "Stores" management list be removed from Admin's nav?

**Yes, remove it entirely.**

An admin with exactly one store has nothing to browse in a store list. The Stores page currently lets admins rename their stores — but under the new model, store creation, renaming, and deletion should belong exclusively to Super Admin. Admin's single store is their operational territory, not something they should be reconfiguring. This also prevents an Admin from renaming the store out from under the Super Admin who created it.

The `StoreController`'s `PUT /{id}` (rename) and `DELETE /{id}` (delete) endpoints should either be restricted to `SUPER_ADMIN` role or removed from the Admin's available actions. The `GET /api/stores` list endpoint can be kept for internal use (used as a source of store info in various places) but should not power a dedicated management page for Admins.

### 5b. Store detail/settings — read-only for Admin, or editable?

**Admin sees their store info read-only; Super Admin owns editing.**

Under this model, Admin should see their own store's name and details (useful context at the top of the dashboard header, or in a simple "My Store" info banner), but not edit them. Rationale:

- Store identity (name, code, location) is set by the Super Admin when onboarding the owner. It's platform data, not operational data.
- Admin's day-to-day job is employees, tasks, categories, and checklists — not store configuration.
- Giving Admin edit rights over their own store while denying it for other stores creates an inconsistent permission model.

**Practical implementation:** Remove the `StoreFormModal` edit button from the Admin UI. Replace the "Stores" nav tab with a simple "My Store" info section (store name, store code, location — displayed as static text, possibly in the dashboard header or a small card on the Home page).

### 5c. Categories, Tasks, Employees — remain with Admin, scoped to their store

**Confirmed: these stay with Admin.** These are Admin's core operational responsibilities.

**Code changes needed for automatic scoping:**

- **Categories:** Already owner-scoped, no `storeId` involved. No change.
- **Tasks:** The `appliesToAllStores` flag and the store-picker in `TaskFormModal` currently let an Admin scope tasks to specific stores vs. all stores. Under single-store, "all stores" and "specific store" always mean the same thing. The store-picker in `TaskFormModal` can be simplified or hidden — the backend already handles both paths correctly (the `resolveStores` method works with a list of one). The filter dropdown in `Tasks.tsx` that lets admins filter tasks by store can be removed since there's only one.
- **Employees:** The `listAssignableStores` endpoint returns the Admin's owned stores for the employee assignment dropdown. With one store, this returns one option. The multi-select behavior in `EmployeeFormModal` can be simplified to a read-only "this store" label, since the employee always belongs to the Admin's single store. Backend unchanged.
- **History:** Currently has a multi-store picker. Under single-store, auto-scope to the Admin's one store — no picker shown, no user selection needed.

### 5d. Should Super Admin's dashboard gain new capabilities?

**Yes — two additions are warranted:**

1. **Store detail view per owner:** The Super Admin currently sees a flat list of owners and their stores, with activate/deactivate controls. They have no way to see the checklist health or operational status of any specific store. Under the new model, Super Admin is the only one with cross-store visibility, so they should be able to drill into a store's daily checklist detail (currently only accessible to the store's Admin). Add a "View Store Detail" action on each row of the OwnerList that opens the checklist history for that store (reusing the existing `ChecklistHistoryDetail` API and the `StoreDetailTable` component). 

2. **Enforce "one store per owner" in the Add Owner form:** The `OwnerFormModal` currently allows assigning an existing store OR creating a new store at owner-creation time. The `AssignStoreModal` (the "Add Store" button on an existing owner's row in `OwnerList`) must be blocked when the owner already has an active store. This guard should be both in the API (`assignStore` in `OwnerManagementService`) and in the UI (hide or disable the "Add Store" button for owners who already have one active store).

---

## Part 6 — Complete File Change List

### Database / Migration

| File | Change |
|------|--------|
| `backend/src/main/resources/db/migration/V27__enforce_single_store_per_owner.sql` | **NEW** — adds `UNIQUE` constraint on `store_owners.user_id` |

### Backend — Entities & Repositories

| File | Change |
|------|--------|
| `backend/src/main/java/com/nforce/retailops/entity/StoreOwner.java` | Change `@ManyToOne` → `@OneToOne` on the `owner` field |
| `backend/src/main/java/com/nforce/retailops/repository/StoreOwnerRepository.java` | Add `findByUserId(Long)` returning `Optional<StoreOwner>`; keep `findByOwnerId` for any remaining list uses during transition; add `existsByUserId(Long)` for the guard check |

### Backend — Controllers & Services

| File | Change |
|------|--------|
| `backend/src/main/java/com/nforce/retailops/service/OwnerManagementService.java` | `assignStore()` — add guard: throw if owner already has an active `store_owners` row; `listOwners()` — simplify: one row per owner (no longer one-row-per-store-per-owner in the listing) |
| `backend/src/main/java/com/nforce/retailops/service/StoreService.java` | `listStores()` — simplify from list to single-store fetch; remove batch count logic; `renameStore()` and `deleteStore()` — restrict to Super Admin or remove |
| `backend/src/main/java/com/nforce/retailops/controller/StoreController.java` | Change `@PreAuthorize` to `hasRole('SUPER_ADMIN')` for rename/delete, OR remove those endpoints entirely from Admin access |
| `backend/src/main/java/com/nforce/retailops/service/TaskService.java` | `resolveStores()` — minor: add validation that, for single-store-per-admin, the submitted storeIds list has at most one entry (optional, since current logic already validates ownership) |
| `backend/src/main/java/com/nforce/retailops/service/EmployeeService.java` | `listAssignableStores()` — simplify from list return to single-store return (optional refactor; current code works with 1 store) |
| `backend/src/main/java/com/nforce/retailops/dto/OwnerResponse.java` | Remove `storeLocation` field if store detail is no longer part of the owner-facing flat list; OR keep as-is since Super Admin still needs it |
| `backend/src/main/java/com/nforce/retailops/service/ChecklistHistoryService.java` | Add Super Admin override path: accept a `storeId` parameter for cross-store drill-in from SuperAdminDashboard |
| `backend/src/main/java/com/nforce/retailops/controller/ChecklistHistoryController.java` | Add new endpoint (Super Admin role) for viewing a specific store's checklist detail |

### Frontend — Admin-facing pages

| File | Change |
|------|--------|
| `frontend/src/types/navigation.ts` | Remove `store-management` from `NavTabKey`; rename/repurpose or remove `store-detail` tab; update `OWNER_NAV_ITEMS` |
| `frontend/src/layouts/DashboardShell.tsx` | Remove `store-management` case; remove `Stores` import; replace `StoreDetail` store-picker behavior; add "My Store" info to Home or header |
| `frontend/src/pages/Stores.tsx` | **DELETE** or convert to read-only "My Store" info panel (no edit controls) |
| `frontend/src/pages/StoreDetail.tsx` | Remove store picker `<select>`; auto-load the Admin's single store on mount (pass `storeId` from `DashboardShell` instead of fetching independently); remove "All Stores" toggle from the operations summary report |
| `frontend/src/pages/History.tsx` | Remove multi-store `SearchableSelect` picker; auto-scope to Admin's one store; remove `stores` / `storesLoading` / `storesError` / `onRetryStores` props |
| `frontend/src/pages/Tasks.tsx` | Remove store filter dropdown from filter bar; simplify `TaskFormModal`'s store-picker when there's only one store |
| `frontend/src/pages/Employees.tsx` | Minor: employee store assignment form may be simplified (still works as-is) |
| `frontend/src/pages/Home.tsx` | Remove "Total Stores" stat card (or replace with "My Store" name); simplify "Stores by Completion" chart to single-store progress bar |
| `frontend/src/hooks/useOwnerStores.ts` | Simplify to return single store (Optional pattern) after backend change; OR keep as-is (list of one still works) |
| `frontend/src/components/TaskFormModal.tsx` | Simplify store picker: either hide (auto-assign to single store) or show as read-only label |
| `frontend/src/components/StoreFormModal.tsx` | **DELETE** (no longer used by Admin) |
| `frontend/src/components/StoreTable.tsx` | **DELETE** or move to Super Admin only |
| `frontend/src/api/ownerStores.ts` | Keep `getStores()` (still used for store info); remove `renameStore()` if Admin loses rename rights |

### Frontend — Super Admin-facing pages

| File | Change |
|------|--------|
| `frontend/src/pages/SuperAdminDashboard.tsx` | Add store detail drill-in per owner row; block "Add Store" button for owners that already have an active store |
| `frontend/src/components/OwnerList.tsx` | Disable/hide "Add Store" action when owner already has an active store |
| `frontend/src/components/AssignStoreModal.tsx` | Keep for now (used to create/assign stores from Super Admin) |
| `frontend/src/components/OwnerFormModal.tsx` | Keep as-is (still used to create new owners with optional store) |
| `frontend/src/api/owners.ts` | Keep all existing owner API functions |

### Frontend — Shared/Navigation components

| File | Change |
|------|--------|
| `frontend/src/components/Sidebar.tsx` | Driven by `OWNER_NAV_ITEMS` — changes automatically when `navigation.ts` is updated |
| `frontend/src/components/BottomNav.tsx` | Same as Sidebar — driven by nav items |
| `frontend/src/components/SearchableSelect.tsx` | No change — still used elsewhere |

---

## Part 7 — Recommended Implementation Order

Each step leaves the app in a working state. Do NOT skip steps or batch them together.

### Step 0 — Data remediation (prerequisite, Super Admin action)
Manually resolve `owner@nforceone.com` having 3 stores. Decision needed: which store does this admin keep? The other two `store_owners` rows must be deactivated (set `active = false`) or the stores reassigned to new owners. This is a Super Admin action in the existing UI (deactivate store → store becomes available for reassignment). No code required — use the existing Super Admin dashboard. **This step must complete before V27 can run.**

### Step 1 — V27 migration: add UNIQUE constraint
Write and apply `V27__enforce_single_store_per_owner.sql`. Verify it runs cleanly against the Neon DB (will fail if Step 0 is not done). Run backend tests (H2 mode with Flyway disabled — tests continue passing). No app behavior change yet.

### Step 2 — Backend entity: `@ManyToOne` → `@OneToOne`
Update `StoreOwner.java`. Update `StoreOwnerRepository` to add `findByUserId` returning `Optional`. Update all service methods that call `storeOwnerRepository.findByOwnerId(ownerId)` and use the result as a list — convert them to use the single-store variant. Verify the backend compiles and all 136 tests still pass.

### Step 3 — Backend guard: block multi-store assignment
In `OwnerManagementService.assignStore()`, add a check: if `storeOwnerRepository.existsByUserId(ownerId)` and the existing record is active, throw `InvalidOwnerRequestException("This owner already has an active store assigned")`. This prevents the problem from recurring. Run backend tests.

### Step 4 — Backend: remove Admin's rename/delete store access
Either change `StoreController`'s `PUT /{id}` and `DELETE /{id}` to `@PreAuthorize("hasRole('SUPER_ADMIN')")`, or move store editing to `SuperAdminController`. Run backend tests. Verify the `/api/stores` GET still works for Admin (needed for store info in frontend).

### Step 5 — Frontend: simplify Admin navigation
Remove `store-management` from `NavTabKey` and `OWNER_NAV_ITEMS`. Remove the `Stores` page render case from `DashboardShell`. Update `DashboardShell` to pass the Admin's single store ID (from `useOwnerStores`) as a prop to pages that need it. Run `npm run build` and verify no TS errors.

### Step 6 — Frontend: simplify store-dependent Admin pages
Update `StoreDetail.tsx` to accept a `storeId` prop (no internal fetch / no picker). Update `History.tsx` to remove the store picker and auto-scope. Update `Home.tsx` to replace "Total Stores" stat with single-store context. Update `Tasks.tsx` to remove the store filter dropdown. Run frontend tests.

### Step 7 — Frontend: Super Admin guard on "Add Store"
In `OwnerList.tsx`, disable the "Add Store" button for owners who already have an active `storeId`. Check `owner.storeId != null && owner.storeActive === true`. This is a UI-only guard (the backend guard from Step 3 catches any bypass).

### Step 8 — Full regression testing
Manual test protocol:
1. Login as Admin (`owner@nforceone.com`) — should land on dashboard with no "Stores" nav tab
2. Navigate to Store Detail — single store auto-selected, no picker dropdown
3. Navigate to History — auto-scoped to single store, no store picker
4. Create a task — store picker shows single store or is absent
5. Create an employee — store assignment shows single store
6. Login as Super Admin — verify owner list shows clean one-store-per-owner rows
7. Try to assign a second store to an owner who already has one — should get an error
8. Login as Employee — no changes, should behave exactly as before

---

## Part 8 — Appendix: File-by-file Detail

### Key files examined (read-only)

| File | Role in analysis |
|------|-----------------|
| `V3, V7, V8` migrations | Established store-owner DB history |
| `StoreOwner.java` | Confirmed `@ManyToOne` annotation |
| `StoreOwnerRepository.java` | Confirmed `findByOwnerId` returns `List` |
| `StoreService.java` | Multi-store batched list logic |
| `TaskService.java` | `resolveStores()` validates list of store IDs |
| `EmployeeService.java` | Union-across-stores in `listEmployees` |
| `OwnerManagementService.java` | `assignStore()` has no uniqueness guard |
| `OwnerProvisioningService.java` | `createOwnerAccount` — single store per creation, correct |
| `DashboardShell.tsx` | Has both `store-management` and `store-detail` tabs |
| `navigation.ts` | `OWNER_NAV_ITEMS` includes "Stores" and "Store Detail" |
| `Stores.tsx` | Admin's multi-store management list |
| `StoreDetail.tsx` | Has store picker dropdown |
| `History.tsx` | Has multi-store `SearchableSelect` |
| `Home.tsx` | Charts aggregated across all owned stores |
| `SuperAdminDashboard.tsx` | Flat owner+store list, no store drill-in |
| `SuperAdminController.java` | `assignStore` endpoint exists, no uniqueness guard |
| Live DB query | **Praveen Kumar has 3 stores — blocking issue** |
