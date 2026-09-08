# Demo Data Plan

**Status:** Plan only — no data has been modified.  
**Date:** 2026-09-07  
**Branch:** vigneshdev  

---

## Summary & Recommendation

### What currently exists
- **6 stores** — 4 are clearly test/dev artifacts; 2 ("River way - Store 2" and "Scoopshire") are borderline (names are ambiguous — see Part 2 notes).
- **5 owner accounts** — all test accounts with names like "Test owner added", "Test owner123", "Test owner email". None are presentation-ready.
- **5 employee accounts** — all test accounts (e.g. "Test Employee", "2 Store Employee", "Emp Ruha").
- **1 super admin** — `superadmin@nforceone.com` / name "Super Admin" — leave exactly as-is.
- **Categories and tasks** — mixed. Praveen Kumar's store has some good real-sounding tasks (Prepare Waffle Cones, Verify freezer doors sealed) buried among test/trigger categories. Guard Verify Store has a complete set for its store. Several tasks are inactive, unlinked from stores, or named "ManualTriggerCat2"/"TriggerCat-NotifTest" — clearly test scaffolding.
- **61 task_responses**, **12 raised_issues**, **11 admin_corrections**, **43 notifications** — all dev/test data, some useful for feature testing but not for a demo.

### What to remove
All stores, owners, employees, categories, tasks, task_responses, admin_corrections, raised_issues, and notifications **except the Super Admin account**. Full safe deletion order in Part 4.

### What to add
- **2 stores**: Scoops & Co. — Jubilee Hills (flagship) and Scoops & Co. — Banjara Hills (second location)
- **2 owner accounts**: one per store, realistic names
- **5 employees**: 3 single-store, 2 multi-store (demonstrating that capability)
- **4 categories per store** with a rich, realistic task set covering all schedule types, response types, completion types, and at least one task with a guidance note
- Profile pictures via `pravatar.cc` (reachable, free, HTTPS — confirmed `200 OK`)

---

## Part 1 — Current Data Audit

### 1. Owners

| ID | Full Name | Email | Store | Store Active | User Active | Created |
|----|-----------|-------|-------|-------------|-------------|---------|
| 2 | Praveen Kumar | owner@nforceone.com | River way - Store 2 | ✓ (active link) | ✓ | 2026-08-26 |
| 2 | Praveen Kumar | owner@nforceone.com | Scoopshire | ✗ (inactive link) | ✓ | 2026-08-26 |
| 5 | Test owner added | owner12@nforceone.com | Popsicles | ✓ | ✓ | 2026-08-27 |
| 34 | Test owner email | maheshwar.mettupally@nforceone.com | Guard Verify Store 1788498313851 | ✓ | ✓ | 2026-09-02 |
| 42 | Test owner123 | testowner2341@nforceone.com | Downtown - Store 1 | ✓ | ✓ | 2026-09-04 |

**Notes:**
- Praveen Kumar owns River way - Store 2 (active) and is historically linked to Scoopshire (inactive link). "Praveen Kumar" is the closest to a real name in the list.
- All emails are `@nforceone.com` internal test addresses. No demo-ready credentials exist.
- Super Admin: `superadmin@nforceone.com`, name "Super Admin", has avatar set. **Do not touch.**

### 2. Stores

| ID | Name | Active | Store Code | Owner | Task Responses |
|----|------|--------|-----------|-------|---------------|
| 1 | Downtown - Store 1 | ✓ | 10001 | Test owner123 | 13 |
| 3 | River way - Store 2 | ✓ | 10003 | Praveen Kumar | 44 |
| 4 | Popsicles | ✓ | 10004 | Test owner added | 0 |
| 6 | Scoopshire | ✓ | 10006 | (no active owner) | 4 |
| 13 | Guard Verify Store 1788498313851 | ✓ | 10009 | Test owner email | 0 |
| 15 | Downtown Madhapur | ✓ | 10011 | (no active owner) | 0 |

**Notes:**
- "Guard Verify Store 1788498313851" — test store created during a guard/verification test run. Clearly dev artifact.
- "Popsicles" and "Downtown Madhapur" — no task history. Disposable.
- "River way - Store 2" and "Scoopshire" — ambiguous. They sound like real demo names and "River way - Store 2" has the most history (44 task_responses). However they follow a naming pattern inconsistent with a professional demo ("Store 2", "Scoopshire" is a made-up name). **Flagged for your decision** — recommendation is to replace all store names with polished alternatives and clear all history for a clean demo.
- "Downtown - Store 1" — 13 responses, test history.

### 3. Employees

| ID | Full Name | Email | Active | Assigned Stores | Store Count | Created |
|----|-----------|-------|--------|----------------|------------|---------|
| 3 | Test Employee | employee@nforceone.com | ✓ | River way - Store 2, Scoopshire | 2 | 2026-08-26 |
| 6 | Emp Ruha | vyshnavirao.jallipalli@nforceone.com | ✓ | Scoopshire | 1 | 2026-08-27 |
| 7 | 2 Store Employee | 2store@test.com | ✓ | Downtown - Store 1, River way - Store 2 | 2 | 2026-08-28 |
| 20 | Sarwesh Test | sarwesh@gmail1.com | ✓ | Downtown - Store 1 | 1 | 2026-08-31 |
| 35 | Test Employee Email | prashanth.shapuram@nforceone.com | ✓ | River way - Store 2, Scoopshire | 2 | 2026-09-02 |

**Notes:**
- All names/emails are clearly test artifacts ("Test Employee", "2 Store Employee", "Emp Ruha").
- "Emp Ruha" email (`vyshnavirao.jallipalli@nforceone.com`) — real team member email. Worth noting but the account name is test-grade.
- Multi-store employees exist (IDs 3, 7, 35) — this feature works and should be preserved in the demo.

### 4. Categories (flagged)

**Praveen Kumar's store categories:**

| ID | Name | Active | Task Count | Flag |
|----|------|--------|-----------|------|
| 1 | Preparation | ✓ | 5 | ✅ Real |
| 2 | Cleaning | ✗ | 3 | ✅ Real (but inactive) |
| 3 | Closing | ✓ | 1 | ✅ Real |
| 4 | Evening | ✓ | 1 | ⚠️ Ambiguous (vague name) |
| 10 | Manual Test Category Trigger 1 | ✗ | 0 | 🚫 Test artifact |
| 11 | ManualTriggerCat2 | ✗ | 0 | 🚫 Test artifact |
| 12 | TriggerCat-NotifTest | ✗ | 0 | 🚫 Test artifact |

**Test owner email's store categories:**

| ID | Name | Active | Task Count | Flag |
|----|------|--------|-----------|------|
| 13 | Opening | ✓ | 2 | ✅ Real |
| 14 | Cleaning | ✓ | 2 | ✅ Real |
| 15 | Closing | ✓ | 2 | ✅ Real |

### 5. Tasks (flagged)

| ID | Name | Category | Stores | Schedule | Response Type | Completion | Has Note | Responses | Flag |
|----|------|----------|--------|----------|--------------|-----------|----------|-----------|------|
| 1 | Clean scoop wells | Cleaning | Downtown-1, River way-2 | EVERY_DAY | NUMERIC | SINGLE | ✗ | 6 | ✅ Real |
| 2 | Prepare boba | Preparation | ALL stores | EVERY_DAY | YES_NO | SINGLE | ✗ | 4 | ✅ Real |
| 4 | Sweep & Mop Floor | Cleaning | ALL stores | EVERY_DAY | DONE_NOT_DONE | SINGLE | ✗ | 6 | ✅ Real (inactive) |
| 5 | Prepare Waffle Cones | Preparation | River way-2 | EVERY_DAY | DONE_NOT_DONE | SINGLE | ✗ | 13 | ✅ Real |
| 6 | Prepare Topping bar | Preparation | ALL stores | EVERY_DAY | DONE_NOT_DONE | MULTIPLE | ✗ | 12 | ✅ Real |
| 7 | Sanitize scoop wells | Cleaning | River way-2 | EVERY_DAY | DONE_NOT_DONE | SINGLE | ✗ | 5 | ✅ Real (inactive) |
| 8 | Verify freezer doors sealed | Closing | ALL stores | EVERY_DAY | DONE_NOT_DONE | MULTIPLE | ✗ | 15 | ✅ Real |
| 10 | Temparature Set | Evening | ALL stores | EVERY_DAY | TEXT | SINGLE | ✗ | 0 | ⚠️ Typo + vague (inactive) |
| 11 | Manual Trigger Test Task 2 | Preparation | ALL stores | EVERY_DAY | YES_NO | SINGLE | ✗ | 0 | 🚫 Test artifact (inactive) |
| 12 | TriggerTask-NotifTest | Preparation | ALL stores | EVERY_DAY | YES_NO | SINGLE | ✗ | 0 | 🚫 Test artifact (inactive) |
| 14 | Turn on lights and equipment | Opening | Guard-store | EVERY_DAY | TEXT | SINGLE | ✗ | 0 | ✅ Real |
| 15 | Wipe and sanitize all surfaces | Cleaning | Guard-store | EVERY_DAY | DONE_NOT_DONE | MULTIPLE | ✗ | 0 | ✅ Real |
| 16 | Sweep and mop the floors | Cleaning | Guard-store | EVERY_DAY | YES_NO | MULTIPLE | ✗ | 0 | ✅ Real |
| 17 | Turn off equipment and lights | Closing | Guard-store | EVERY_DAY | YES_NO | MULTIPLE | ✗ | 0 | ✅ Real |
| 18 | Take out trash and secure the area | Closing | Guard-store | EVERY_DAY | DONE_NOT_DONE | SINGLE | ✗ | 0 | ✅ Real |
| 19 | Temperature check | Opening | Guard-store | EVERY_DAY | NUMERIC | SINGLE | ✗ | 0 | ✅ Real |

**Notable gaps:**
- No tasks use schedule types other than `EVERY_DAY`. Demo should cover `WEEKDAYS`, `WEEKENDS`, `SPECIFIC_DAYS`, and `ONE_TIME`.
- No tasks have a guidance note (`description`) attached — demo should show at least one.
- No tasks with `TEXT` response type are active and assigned to a store.
- NUMERIC tasks exist (clean scoop wells, temperature check) but no unit is set on "Clean scoop wells".

### 6. Raised Issues, Admin Corrections, Notifications

**Raised Issues (12 total):**
- IDs 1–12, dates 2026-09-04 to 2026-09-07
- Mix of test strings ("Dummy", "erfqerfe", "Verify fix test") and reasonable-sounding ones ("The freezer in the back is making a loud noise", "Freezer unit is making loud noise - needs urgent check", "Back door lock is broken, security risk")
- Issue 12 is `ACKNOWLEDGED` — the only one showing the 3-state machine in non-default state
- **Recommendation:** Clear all. Most reference test employees and test stores. The demo should seed fresh, realistic issues as part of the demo data.

**Admin Corrections (11 total):**
- All reference task_responses 49, 54, 60, 61 — which are "Prepare Waffle Cones" (responses 54/60/61) and "Clean scoop wells" (response 49)
- Several have no `corrected_by_name` (NULL) — entered before that field was wired up
- **Recommendation:** Clear all. They'll cascade-delete when task_responses are deleted anyway.

**Notifications (43 total):**
- Mix of CATEGORY_ADDED, TASK_ADDED, EMPLOYEE events, ISSUE_RAISED, CORRECTION_MADE, STORE_ZERO_ACTIVITY
- All reference test data
- **Recommendation:** Clear all. Notifications auto-generate from app events, so demo activity will populate them naturally.

---

## Part 2 — What to Remove

### Definitively remove (test artifacts)
- **Stores:** "Guard Verify Store 1788498313851", "Popsicles", "Downtown Madhapur"
- **Store names to replace:** "Downtown - Store 1", "River way - Store 2", "Scoopshire" — names are either generic numbered or made-up. Replace with polished names.
- **All owner accounts** (IDs 2, 5, 34, 42) — names and emails are all test-grade
- **All employee accounts** (IDs 3, 6, 7, 20, 35)
- **Categories flagged 🚫:** IDs 10, 11, 12 (Manual Test Category Trigger 1, ManualTriggerCat2, TriggerCat-NotifTest)
- **Tasks flagged 🚫:** IDs 11, 12 (Manual Trigger Test Task 2, TriggerTask-NotifTest)
- **All task_responses** (61 rows) — all dev history
- **All admin_corrections** (11 rows)
- **All raised_issues** (12 rows)
- **All notifications** (43 rows)

### Ambiguous — flagged for your decision
- **"River way - Store 2"** — most history (44 responses), sounds like a draft name not a final one. Recommendation: replace name rather than keep.
- **"Scoopshire"** — playful name, could fit an ice cream brand. Recommendation: replace with something more geographic/real-sounding.
- **"Evening" category** — vague but not offensive. Recommendation: remove in favour of a proper "End of Day" or "Closing Checks" category.
- **Praveen Kumar** — closest to a real name in the dataset. The email `owner@nforceone.com` is internal. Recommendation: replace the account.

### Do NOT remove
- Super Admin account (ID 1 in super_admins, email `superadmin@nforceone.com`)

### Cascade safety analysis

**Foreign key chain (must delete in this order):**

```
notifications
  └── related_issue_id → raised_issues (ON DELETE CASCADE — auto)
admin_corrections
  └── task_response_id → task_responses
task_responses
  └── task_id → tasks (ON DELETE RESTRICT — blocks task deletion if responses exist)
employee_stores
  └── employee_id → store_employees (ON DELETE CASCADE — auto)
store_employees / store_owners / categories / tasks / task_stores / task_selected_days
  └── all reference users, stores
stores
  └── referenced by task_responses, raised_issues, store_owners, employee_stores
users (owner/employee)
  └── referenced by everything above
```

**Safe deletion order:**
1. `notifications` — no dependents
2. `admin_corrections` — depends on task_responses
3. `task_responses` — depends on tasks; blocks task deletion via RESTRICT
4. `raised_issues` — (notifications already gone; notifications cascade from raised_issues ON DELETE CASCADE so step 1 covers it)
5. `task_stores`, `task_selected_days` — auto cascade from task delete, but safe to pre-delete
6. `tasks` — now safe once task_responses gone
7. `categories` — now safe once tasks gone
8. `employee_stores` — cascades from store_employees delete
9. `store_employees` — depends on users, stores
10. `store_owners` — depends on users, stores
11. `stores` — now safe once store_employees, store_owners, task_responses gone
12. `users` (owner and employee rows only) — last

**Hard delete vs soft delete:**
- Task_responses with admin_corrections attached: **hard delete is fine** here because all this data is test data, not real production history. No soft-delete needed.
- If you ever want to be extra safe: deactivate employees/owners first, then delete. But for a clean demo reset, hard-delete in the FK order above is appropriate.

---

## Part 3 — Proposed Demo Data Set

### Stores

| Store | Name | Rationale |
|-------|------|-----------|
| A | **Scoops & Co. — Jubilee Hills** | Flagship. Geographic real Hyderabad neighbourhood. Fits ice cream/dessert retail context from PRD. |
| B | **Scoops & Co. — Banjara Hills** | Second location. Same brand, different Hyderabad neighbourhood. |

Two stores is the right demo count — enough to show multi-store management without overwhelming the SA dashboard.

### Owner / Admin Accounts

| Store | Full Name | Email | Password |
|-------|-----------|-------|---------|
| Jubilee Hills | **Priya Ramachandran** | priya.ramachandran@scoopsandco.com | Password123! |
| Banjara Hills | **Karthik Menon** | karthik.menon@scoopsandco.com | Password123! |

Both should have `force_password_change = false` and `must_reset_password = false` so demo login is instant.

### Super Admin (no change)

| Name | Email | Note |
|------|-------|------|
| Super Admin | superadmin@nforceone.com | Existing account, existing avatar, existing credentials. Do not touch. |

### Employee Accounts

| Full Name | Email | Assigned Store(s) | Type | Password |
|-----------|-------|------------------|------|---------|
| Ananya Reddy | ananya.reddy@scoopsandco.com | Jubilee Hills only | Single-store | Password123! |
| Rohit Sharma | rohit.sharma@scoopsandco.com | Jubilee Hills only | Single-store | Password123! |
| Divya Nair | divya.nair@scoopsandco.com | Banjara Hills only | Single-store | Password123! |
| Arjun Pillai | arjun.pillai@scoopsandco.com | **Both stores** | Multi-store | Password123! |
| Sneha Patel | sneha.patel@scoopsandco.com | **Both stores** | Multi-store | Password123! |

- Ananya and Rohit: single-store employees under Priya's management
- Divya: single-store under Karthik
- Arjun and Sneha: multi-store, assigned to both — demonstrates the cross-store employee capability clearly

### Categories and Tasks

Both stores share the same category structure (owned by their respective admin accounts). This is realistic — a chain would standardise its checklist.

#### Category 1: Opening Checks
Schedule mix: daily + weekday-only

| Task Name | Schedule | Response Type | Completion | Note |
|-----------|----------|--------------|-----------|------|
| Unlock entrance and disable alarm | EVERY_DAY | YES_NO | SINGLE | — |
| Turn on display freezers and verify temperatures | EVERY_DAY | NUMERIC (°C, min 0, max 8) | SINGLE | **Guidance note:** "Walk-in freezer target: 2–4°C. Display case target: 4–6°C. Log the actual reading." |
| Check float cash in till | WEEKDAYS | NUMERIC (₹, min 0, max 5000) | SINGLE | — |
| Verify daily specials board is updated | EVERY_DAY | DONE_NOT_DONE | SINGLE | — |

#### Category 2: Preparation
Schedule mix: daily + weekend-only + specific day

| Task Name | Schedule | Response Type | Completion | Note |
|-----------|----------|--------------|-----------|------|
| Prepare waffle cones — morning batch | EVERY_DAY | NUMERIC (batches, min 1, max 10) | SINGLE | — |
| Restock topping bar (sprinkles, nuts, sauces) | EVERY_DAY | DONE_NOT_DONE | MULTIPLE | — |
| Prepare fresh fruit toppings | WEEKDAYS | DONE_NOT_DONE | SINGLE | — |
| Set up weekend promotional display | WEEKENDS | DONE_NOT_DONE | SINGLE | — |
| Monthly deep-clean of ice cream machines | SPECIFIC_DAYS (1st of month) | YES_NO | SINGLE | **Guidance note:** "Use the approved food-safe cleaning solution in the storeroom (top shelf). Run three rinse cycles before returning to service." |

#### Category 3: Cleaning & Hygiene
Schedule mix: daily + weekday-only

| Task Name | Schedule | Response Type | Completion | Note |
|-----------|----------|--------------|-----------|------|
| Wipe and sanitize all counters and serving areas | EVERY_DAY | DONE_NOT_DONE | MULTIPLE | — |
| Clean scoop wells — mid-shift | EVERY_DAY | DONE_NOT_DONE | SINGLE | — |
| Sweep and mop the floor | EVERY_DAY | DONE_NOT_DONE | SINGLE | — |
| Clean restrooms | WEEKDAYS | DONE_NOT_DONE | MULTIPLE | — |
| Log any pest or hygiene observations | EVERY_DAY | TEXT (max 300 chars) | SINGLE | — |

#### Category 4: Closing Checks
Schedule mix: daily + one-time

| Task Name | Schedule | Response Type | Completion | Note |
|-----------|----------|--------------|-----------|------|
| Record end-of-day cash total | EVERY_DAY | NUMERIC (₹, min 0, max 100000) | SINGLE | — |
| Verify all freezer doors are sealed | EVERY_DAY | YES_NO | SINGLE | — |
| Turn off equipment and lights | EVERY_DAY | DONE_NOT_DONE | SINGLE | — |
| Secure back door and set alarm | EVERY_DAY | DONE_NOT_DONE | SINGLE | — |
| Closing manager sign-off | EVERY_DAY | TEXT (max 100 chars) | SINGLE | **Guidance note:** "Enter your full name as sign-off. This confirms you performed the final walkthrough." |

**Coverage achieved by this task set:**
- Schedule types: EVERY_DAY ✓, WEEKDAYS ✓, WEEKENDS ✓, SPECIFIC_DAYS ✓ — (ONE_TIME is edge-case; can be added if needed)
- Response types: YES_NO ✓, DONE_NOT_DONE ✓, NUMERIC ✓, TEXT ✓
- Completion types: SINGLE ✓, MULTIPLE ✓
- Guidance notes: 3 tasks across 2 categories ✓
- Total tasks per store: 18 across 4 categories

### Profile Pictures

All three services (`ui-avatars.com`, `randomuser.me`, `pravatar.cc`) return HTTP 200 from this environment.

**Recommended approach: `pravatar.cc`**
- Royalty-free, no auth required, portrait photos by index number
- HTTPS, returns a real JPEG portrait
- Pattern: `https://i.pravatar.cc/300?img={N}` (N = 1–70)
- To embed as base64: `curl -s "https://i.pravatar.cc/300?img=1" | base64` then prefix with `data:image/jpeg;base64,`

**Proposed assignments:**

| Account | Name | Pravatar Index | URL |
|---------|------|---------------|-----|
| Owner | Priya Ramachandran | img=47 (woman) | https://i.pravatar.cc/300?img=47 |
| Owner | Karthik Menon | img=12 (man) | https://i.pravatar.cc/300?img=12 |
| Employee | Ananya Reddy | img=45 (woman) | https://i.pravatar.cc/300?img=45 |
| Employee | Rohit Sharma | img=11 (man) | https://i.pravatar.cc/300?img=11 |
| Employee | Divya Nair | img=48 (woman) | https://i.pravatar.cc/300?img=48 |
| Employee | Arjun Pillai | img=15 (man) | https://i.pravatar.cc/300?img=15 |
| Employee | Sneha Patel | img=44 (woman) | https://i.pravatar.cc/300?img=44 |

Verify the images look right before embedding — pravatar indexes are stable but occasionally updated.

---

## Part 4 — Safe Execution Plan

### Phase 0: Backup (recommended)
Before any deletion, run a `pg_dump` snapshot to `/tmp/pre-demo-backup.sql`. Irreversible once deleted.

### Phase 1: Delete all test data (hard deletes, FK order)

```sql
-- Step 1: notifications (no dependents)
DELETE FROM notifications;

-- Step 2: admin_corrections (depends on task_responses)
DELETE FROM admin_corrections;

-- Step 3: raised_issues (notifications already gone; their FK cascade was ON DELETE CASCADE)
DELETE FROM raised_issues;

-- Step 4: task_responses (blocks task deletion; must go first)
DELETE FROM task_responses;

-- Step 5: task_stores, task_selected_days (will cascade from task delete, but explicit is safer)
DELETE FROM task_stores;
DELETE FROM task_selected_days;

-- Step 6: tasks
DELETE FROM tasks;

-- Step 7: categories
DELETE FROM categories;

-- Step 8: employee_stores (cascades from store_employees, but explicit first)
DELETE FROM employee_stores;

-- Step 9: store_employees
DELETE FROM store_employees;

-- Step 10: store_owners (all rows, all stores)
DELETE FROM store_owners;

-- Step 11: stores
DELETE FROM stores;

-- Step 12: users (owners and employees only — NOT the super_admin's linked user if one exists)
-- First identify which user IDs are owners/employees:
-- DELETE FROM user_roles WHERE user_id NOT IN (SELECT super_admin_id FROM super_admins);
-- DELETE FROM users WHERE id NOT IN (SELECT super_admin_id FROM super_admins);
-- Note: super_admins table uses super_admin_id as PK, not linked via users table —
-- confirm this before running the users DELETE.
```

**Verify before proceeding to Phase 2:** `SELECT COUNT(*) FROM task_responses;` → 0. `SELECT COUNT(*) FROM stores;` → 0.

### Phase 2: Create new stores

```sql
INSERT INTO stores (name, active, store_code, location, open_time, close_time)
VALUES
  ('Scoops & Co. — Jubilee Hills', true, <next_code>, 'Jubilee Hills, Hyderabad', '09:00', '22:00'),
  ('Scoops & Co. — Banjara Hills', true, <next_code+1>, 'Banjara Hills, Hyderabad', '09:00', '22:00');
```

Use the app's `StoreService.createStore()` flow (via API or direct SQL) — the app manages `store_code_counter`. Best to create stores via the SA dashboard UI or API to keep the counter in sync.

**Verify:** `SELECT id, name, store_code FROM stores;` → 2 rows.

### Phase 3: Create owner accounts

Create via SA dashboard UI (`POST /api/admin/owners`) to ensure:
- Role assignment via `user_roles`
- `store_owners` row created
- `force_password_change = false` set manually after creation (or patch via SQL after)
- Password set to `Password123!` (bcrypt hash, set via API on first login or seed directly)

**Verify:** `SELECT u.full_name, so.active, s.name FROM store_owners so JOIN users u ON u.id = so.user_id JOIN stores s ON s.id = so.store_id;` → 2 rows.

### Phase 4: Create categories and tasks

For each owner, create 4 categories and 18 tasks via the owner dashboard UI or `POST /api/categories` + `POST /api/tasks`. API approach is faster and reproducible.

**Verify per store:** `SELECT c.name, COUNT(t.id) AS tasks FROM categories c LEFT JOIN tasks t ON t.category_id = c.id GROUP BY c.name;` → 4 categories × 18 tasks.

### Phase 5: Create employee accounts

Create via owner dashboard or `POST /api/employees`. For multi-store employees (Arjun, Sneha): create under one owner, then assign to the second store via `PUT /api/employees/{id}/stores`.

**Verify:** `SELECT u.full_name, array_agg(s.name) FROM store_employees se JOIN users u ON u.id = se.user_id JOIN employee_stores es ON es.employee_id = se.id JOIN stores s ON s.id = es.store_id GROUP BY u.full_name;` → 5 employees, 2 with 2 stores each.

### Phase 6: Assign profile pictures

For each account:
```bash
IMG=$(curl -s "https://i.pravatar.cc/300?img=47" | base64)
AVATAR="data:image/jpeg;base64,$IMG"
# PATCH /api/me/avatar with {"avatarUrl": "$AVATAR"} using that user's JWT
```

Or do it via the UI (Profile → Change Photo) logged in as each user. Fastest for 7 accounts is a small script.

### Phase 7: Seed realistic demo events (optional but recommended)

After all accounts exist, log in as employees and complete a few checklists across 2–3 past dates (using the API with `response_date` set to past dates if the endpoint allows, or accept today's data only). Raise 1–2 realistic issues per store so the SA dashboard and notification system show live data.

**Verify final state:**
- SA dashboard shows 2 stores, 2 owners, 5 employees
- Each store shows categories and today's checklist
- At least 1 notification visible per owner

---

## Part 5 — Flags & Risks

| Item | Reversible? | Risk |
|------|------------|------|
| DELETE task_responses | ❌ Hard delete | Low — all test data |
| DELETE admin_corrections | ❌ Hard delete | Low — all test data |
| DELETE raised_issues | ❌ Hard delete | Low — all test data |
| DELETE notifications | ❌ Hard delete | Low — all test data |
| DELETE tasks/categories | ❌ Hard delete | Low after responses gone |
| DELETE users (owners/employees) | ❌ Hard delete | Low — test accounts only |
| DELETE stores | ❌ Hard delete | Low after all dependents gone |
| Create stores/owners/employees | ✅ Reversible (deactivate or delete) | — |
| Pravatar image fetch + embed | ✅ Reversible | Images are public, no auth |
| Super Admin account | ✅ Not touched | — |

**Recommended:** Take a `pg_dump` before Phase 1. Everything else follows from that safety net.
