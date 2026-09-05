# Employee Ownership Redesign — Analysis

> **Branch:** `vigneshdev` | **Date:** 2026-09-04 | **Status:** Analysis only — no code changes

---

## Summary & Recommendation

**Desired model:** Super Admin creates employees and stores; Admin (OWNER_ADMIN) only assigns/unassigns employees from their store; permanent delete is Super Admin-only.

**Backend is 75% there already.** Employee creation as Super Admin already works (null ownerId path). Store creation independent of owner creation already works (`createUnownedStore()`). The two critical gaps are:

1. **`DELETE /api/employees/{id}` is accessible to OWNER_ADMIN** — it hard-deletes both the StoreEmployee and the User account. Admins should only be able to unassign (which already exists at `DELETE /api/employees/{id}/assignment`).
2. **`Employees.tsx` calls the hard-delete endpoint** from the Admin UI "Delete Employee" button — it should call unassign instead.
3. **`SuperAdminEmployees.tsx` has no permanent delete action** — Super Admin needs one.
4. **`StoreService.deleteStore()` will throw a raw FK violation** for any store with checklist history (stores 1 and 3 in production, confirmed) — needs a business-logic guard before any store-delete UI is exposed.

**Migration risk is LOW.** No schema changes needed. The `employee_stores` join table and `created_by_owner_id` column are already correctly shaped. The only production data concern is that 6 of 7 existing employees have `created_by_owner_id = Praveen Kumar (OWNER_ADMIN)` — a legacy of the old creation model. These rows still work correctly; the column becomes semantically less meaningful going forward.

**Recommended implementation order:** Backend endpoint guard first, then frontend Admin fix, then Super Admin delete UI, then store-delete guard. Each step is independently safe to ship.

---

## Part 1: Current State

### Employee Creation

`POST /api/employees`

```
@PreAuthorize("hasRole('OWNER_ADMIN')")           // class-level
@PreAuthorize("hasAnyRole('SUPER_ADMIN', ...)")   // method-level override on this endpoint
```

Super Admin creation path: `EmployeeProvisioningService.createEmployeeAccount(null, request, Set.of())` — passes `null` as ownerId, assigns no stores at creation time.

**Status: already correct.** Both OWNER_ADMIN and SUPER_ADMIN can call this endpoint. Super Admin creates with no store; Admin creates... but currently also with no store assignment at creation time (they use the Assign modal separately). This is already the desired behavior.

### Employee Deletion

`DELETE /api/employees/{id}`

```
// No method-level override — falls through to class-level:
@PreAuthorize("hasRole('OWNER_ADMIN')")
```

Service implementation (`EmployeeService.deleteEmployee()`):
1. `canManageEmployee()` — checks `created_by_owner_id == caller.ownerId` OR store ownership
2. Hard-deletes the `StoreEmployee` row
3. Hard-deletes the `User` row (cascade removes the auth account entirely)

**Status: WRONG.** An OWNER_ADMIN calling this destroys the employee's account permanently. The desired model says only Super Admin should permanently delete; Admin should unassign.

### Employee Unassign (Already Exists)

`DELETE /api/employees/{id}/assignment`

Removes the employee from the calling admin's store only (removes from `employee_stores` join table for that store). Does not delete the User. The employee may still belong to other stores.

**Status: correct, already exists, just not used by the Admin UI.**

### Store Creation

`POST /api/stores`

```
@PreAuthorize("hasRole('SUPER_ADMIN')")
```

Calls `StoreService.createUnownedStore()` — creates a Store with no owner. Store 15 ("Downtown Madhapur") in production was created this way.

**Status: already correct.**

### Store Deletion

`DELETE /api/stores/{id}`

```
@PreAuthorize("hasRole('SUPER_ADMIN')")
```

`StoreService.deleteStore()`:
1. Finds StoreOwner by storeId
2. Hard-deletes StoreOwner
3. Hard-deletes Store

**Status: DANGEROUS.** No check for dependent history before deleting. The `task_responses` and `task_stores` tables have FK constraints on `stores.id` with NO CASCADE — the DB will throw a `DataIntegrityViolationException` (500 error) if deletion is attempted on a store with any history. See Part 7 for production evidence.

### `canManageEmployee()` Logic

```java
return employee.getCreatedByOwner() != null
    && employee.getCreatedByOwner().getId().equals(caller.getOwnerId())
    || storeOwnerRepository.existsByOwnerUserIdAndStoreId(caller.getUserId(), employee.getStore().getId());
```

This gates the hard-delete endpoint. Under the new model, where all creation is Super Admin-driven, `created_by_owner_id` will always be null for new employees — so the first condition will never be true. The second condition (store ownership) would still apply. The method currently gates the delete endpoint, which is being moved to SUPER_ADMIN only — so `canManageEmployee()` effectively becomes irrelevant for delete once the endpoint guard is fixed.

---

## Part 2: Intended New Model

| Action | Who Can Do It | Endpoint |
|--------|--------------|----------|
| Create employee | Super Admin only | `POST /api/employees` (already SUPER_ADMIN capable) |
| Create store | Super Admin only | `POST /api/stores` (already SUPER_ADMIN only) |
| Assign employee to store | Admin (OWNER_ADMIN) | existing Assign modal flow |
| Unassign employee from store | Admin (OWNER_ADMIN) | `DELETE /api/employees/{id}/assignment` |
| Permanently delete employee | Super Admin only | `DELETE /api/employees/{id}` (needs endpoint guard) |
| Permanently delete store | Super Admin only | `DELETE /api/stores/{id}` (needs history guard) |
| Edit employee details | Admin (OWNER_ADMIN) | `PUT /api/employees/{id}` (unchanged) |
| Toggle employee status | Admin (OWNER_ADMIN) | `PATCH /api/employees/{id}/status` (unchanged) |
| Reset employee password | Admin (OWNER_ADMIN) | existing flow (unchanged) |

Multi-store employees: an employee can belong to multiple stores simultaneously. This is already the data model (`employee_stores` many-to-many). The UI and APIs already support it. No changes needed.

---

## Part 3: Backend Gap Analysis

### Gap 1 — `DELETE /api/employees/{id}` accessible to OWNER_ADMIN

**File:** `backend/src/main/java/com/nforce/retailops/controller/EmployeeController.java`

Current:
```java
@PreAuthorize("hasRole('OWNER_ADMIN')")   // class-level, applies to DELETE /{id}
@DeleteMapping("/{id}")
public ResponseEntity<Void> deleteEmployee(@PathVariable Long id, ...)
```

Needed: add `@PreAuthorize("hasRole('SUPER_ADMIN')")` at method level (same pattern already used on `POST /` to give Super Admin access there).

**Fix complexity: trivial.** One annotation line.

### Gap 2 — `StoreService.deleteStore()` has no history guard

**File:** `backend/src/main/java/com/nforce/retailops/service/StoreService.java`

Current: proceeds directly to delete without checking `task_responses` or `task_stores`.

Needed: before deleting, check if any `task_responses` or `task_stores` rows reference this store. If yes, throw a domain exception mapped to 409 Conflict with a message like "Store has checklist history and cannot be deleted. Archive it instead or clear history first."

**Fix complexity: low.** Two repository count queries + conditional throw + new exception entry in `GlobalExceptionHandler`.

### Non-Gap: `POST /api/employees` already correct

The `createEmployeeAsSuperAdmin` path that `SuperAdminEmployees.tsx` uses (which ultimately calls `POST /api/employees` with a Super Admin token) already works. The endpoint accepts both roles. No backend change needed here.

### Non-Gap: `DELETE /api/employees/{id}/assignment` already correct

Unassign endpoint exists, is OWNER_ADMIN accessible, removes from store without deleting User. Only the frontend needs to call it.

---

## Part 4: Frontend Gap Analysis

### Gap 1 — `Employees.tsx`: Admin "Delete" calls hard-delete instead of unassign

**File:** `frontend/src/pages/Employees.tsx`

`handleConfirmDelete()` at line 128:
```typescript
async function handleConfirmDelete() {
  if (!deleteTarget) return;
  await deleteEmployee(deleteTarget.id);   // ← hard delete, WRONG
  ...
}
```

Needed:
- Change `deleteEmployee(deleteTarget.id)` to `unassignEmployeeFromMyStore(deleteTarget.id)`
- Rename confirm dialog title from "Delete Employee" to "Remove from Store"
- Update dialog message to say "This will remove [name] from your store. They will remain in the system and may still belong to other stores."
- Toast: change "employee removed" to "removed from store"
- The `deleteError` state and UI can stay unchanged

**Fix complexity: low.** 3–4 line changes in one file.

### Gap 2 — `SuperAdminEmployees.tsx`: no permanent delete action

**File:** `frontend/src/pages/SuperAdminEmployees.tsx`

Currently renders a read-only table with a view-details modal. No delete button.

Needed:
- Add delete icon/button per row in the table (or inside the details modal)
- Handler calls `deleteEmployee(id)` from `api/employees.ts` (the hard-delete endpoint, now SUPER_ADMIN only)
- ConfirmDialog with strong destructive warning: "This permanently deletes [name]'s account and removes them from all stores. This cannot be undone."

**Fix complexity: medium.** New state, new handler, new ConfirmDialog instance. May also require updating `SuperAdminEmployeeTable` or its row actions — need to verify that component's current action slots.

### Gap 3 (minor) — `Employees.tsx`: "Assign Employee" button label

With the new model, admins don't create employees — they only assign existing ones. The existing `AssignEmployeeModal` already does assignment (not creation). The button label "Assign Employee" is already correct. No change needed.

---

## Part 5: File Impact

### Backend (changes needed)

| File | Change |
|------|--------|
| `controller/EmployeeController.java` | Add `@PreAuthorize("hasRole('SUPER_ADMIN')")` to `deleteEmployee()` method |
| `service/StoreService.java` | Add history-existence check before deleting store |
| `repository/` (task-related) | Add `countByStoreId(Long storeId)` to TaskResponseRepository and TaskStoreRepository (or raw JPQL) |
| `exception/GlobalExceptionHandler.java` | Add handler for new `StoreHasHistoryException` → 409 |

### Frontend (changes needed)

| File | Change |
|------|--------|
| `pages/Employees.tsx` | `handleConfirmDelete` calls unassign; dialog text updated |
| `pages/SuperAdminEmployees.tsx` | Add permanent delete button + handler + ConfirmDialog |

### Frontend (no change needed)

| File | Reason |
|------|--------|
| `api/employees.ts` | Both `deleteEmployee()` and `unassignEmployeeFromMyStore()` already exist |
| `api/stores.ts` | Store creation API already correct |
| `pages/SuperAdminStores.tsx` | Store delete, if exposed, will benefit from backend guard — no frontend delete action currently exists |
| `components/AssignEmployeeModal.tsx` | Already does assignment correctly |

### Backend (no change needed)

| File | Reason |
|------|--------|
| `service/EmployeeService.java` | `deleteEmployee()` logic is fine once endpoint guard restricts callers to SUPER_ADMIN |
| `service/EmployeeProvisioningService.java` | Super Admin creation path already works |
| All Flyway migrations | No schema changes required |

---

## Part 6: Implementation Order

Each step is independently shippable. Safer to ship in order since Step 1 makes the backend safe before Step 3 exposes delete in the Super Admin UI.

**Step 1 — Backend: lock hard-delete to SUPER_ADMIN** (trivial, 1 line)

Add `@PreAuthorize("hasRole('SUPER_ADMIN')")` to `EmployeeController.deleteEmployee()`. Deploy first. After this, any OWNER_ADMIN calling `DELETE /api/employees/{id}` gets a 403 — the Admin frontend's existing delete button starts failing (user sees an error toast). This is acceptable briefly as a forcing function.

**Step 2 — Frontend: fix Admin unassign** (low, ~10 lines)

Change `Employees.tsx` to call `unassignEmployeeFromMyStore()`. Redeploy. Admin "remove" action now works correctly — removes from their store without destroying the account.

**Step 3 — Frontend: Super Admin permanent delete** (medium, ~40 lines)

Add delete action to `SuperAdminEmployees.tsx` with strong confirmation dialog. This is the only place permanent deletion is accessible post-Step-1.

**Step 4 — Backend: store delete history guard** (medium, ~20 lines)

Add check in `StoreService.deleteStore()`. Do this before any UI exposes a store-delete button to Super Admin. Currently no such button exists in `SuperAdminStores.tsx`, so this is not an emergency — but it must be done before adding one.

---

## Part 7: Data Safety Check

> **This section determines migration risk. Run queries verified against the live Neon DB.**

### Employee Data

```
Total employees:        7
Multi-store employees:  2  (IDs 2, 4 — each assigned to 2 stores)
Zero-store employees:   2  (IDs 1, 29)
```

**Employee ID 29:** `created_by_owner_id = NULL` — already created via the Super Admin path. Proves the new model is partially in use.

**Employees 1–7 (excluding 29):** `created_by_owner_id = 2` (Praveen Kumar, OWNER_ADMIN user_id = 2). These reflect the old model where Admin created employees. The column becomes semantically stale for these rows going forward, but it causes no functional problem — `canManageEmployee()` will still return true for Praveen's admin account based on the creator check, and will also return true via the store ownership check. When the delete endpoint is locked to SUPER_ADMIN, `canManageEmployee()` is no longer called for delete — so this legacy data has zero runtime impact.

**Schema: no changes required.** `employee_stores` many-to-many already exists (V11). `created_by_owner_id` nullable already (V14). No new columns, tables, or migrations needed.

### Store Data

```
Total stores:        7
Unowned stores:      1  (store 15, "Downtown Madhapur" — created via createUnownedStore())
Stores with owner:   6
```

Store 15 existence confirms `createUnownedStore()` is already working in production.

### Checklist History — FK Danger Zones

```
store_id | task_response_count
---------+---------------------
       1 |  13
       3 |  37
```

`task_responses.store_id` has FK REFERENCES stores with **NO CASCADE**. Attempting `DELETE FROM stores WHERE id IN (1, 3)` will throw:

```
ERROR: update or delete on table "stores" violates foreign key constraint
"fk_task_responses_store" on table "task_responses"
Detail: Key (id)=(1) is still referenced from table "task_responses".
```

Same applies for `task_stores.store_id` (V9 migration, no cascade):

```
ALTER TABLE task_stores ADD CONSTRAINT fk_task_stores_store
  FOREIGN KEY (store_id) REFERENCES stores;
```

**Current behavior:** `StoreService.deleteStore()` would throw an unhandled `DataIntegrityViolationException` → 500 error, no user-friendly message. The DB is protecting the data correctly, but the backend surfaces it as a crash rather than a business error.

**Required fix:** Check task history count before deleting. If any rows exist in `task_responses` or `task_stores` for the store, return 409 with a clear message. Do not attempt the delete.

### Migration Risk Summary

| Risk | Severity | Status |
|------|----------|--------|
| Schema changes required | None | Safe |
| Existing employee data corrupted | None | Safe |
| Hard-delete of stores with history | HIGH if no guard | **Fix needed before store-delete UI exposed** |
| Admin loses ability to hard-delete employees | Intended | Step 1 intentionally causes this |
| Legacy `created_by_owner_id` rows | Low | Semantically stale, not functionally broken |
| Multi-store employees (IDs 2, 4) | None | Model already supports this correctly |

**Overall migration risk: LOW** — no schema changes, no data migration, no downtime. The sequence in Part 6 keeps production safe at every intermediate step.
