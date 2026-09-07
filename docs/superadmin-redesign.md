# Super Admin Redesign — Requirements & Design

**Branch:** `vigneshdev`  
**Date:** 2026-09-04  
**Status:** Design only — no code written

---

## Summary & Recommendation

The current Super Admin experience is a single page with a flat owner list. For a platform owner who oversees every store and every Admin across the business, that is insufficient — it conflates account management (who the admins are) with operational visibility (how the stores are performing), and provides no daily overview, no store-centric view, no historical trend visibility, and no audit capability.

**Recommendation:** Rebuild Super Admin as a proper multi-section control center with five top-level nav sections (Home, Admins, Stores, History, Settings), where the current Owners list becomes the Admins section, Stores gets its own dedicated page and drill-in, and Home provides genuine operational intelligence every morning — cross-store completion rates, stores with no activity, a 7-day trend, and a platform activity feed.

The implementation divides cleanly into four phases across multiple sessions. Phases 1–2 (nav restructure + Home dashboard) are the highest-value, most self-contained work. The existing backend (ChecklistHistoryService, OwnerManagementService) already provides most of the data needed — the main work is new read-only endpoints and new frontend pages.

---

## Part 1 — Skills Directory

The `/mnt/skills/` directories (`public/`, `private/`, `examples/`, `user/`) do not exist in this environment. The design below draws on direct analysis of the codebase and professional dashboard/admin-panel patterns.

---

## Part 2 — Current Super Admin Capabilities (Post Single-Store Migration)

**Navigation:** One tab — "Owners" (`SuperAdminNavTabKey = 'owners'`). `navigation.ts:47-51` defines a single-item array. No routing library — state machine like DashboardShell.

**Current page (`SuperAdminDashboard.tsx`):**

| Capability | Detail |
|---|---|
| View all owners | Flat list from `GET /api/owners`, grouped client-side into OwnerCards |
| Stat row | Total Owners, Active Owners, Total Stores (derived from the flat list) |
| Search | Free-text over owner name, email, or store name |
| Create owner | "Add Owner" modal (OwnerFormModal) — name, email, optional store name/location or existing store pick |
| Activate / Deactivate owner | ConfirmDialog → `PATCH /api/owners/{id}/status` |
| Assign store to owner | AssignStoreModal → `POST /api/owners/{id}/stores`; disabled if owner already has an active store |
| Activate / Deactivate store | Toggle per store row → `PATCH /api/owners/{id}/stores/{storeId}/status` |
| View today's checklist | "View Checklist" button (active stores only) → ChecklistHistoryDetailModal for today's ISO date → `GET /api/checklist-history/detail?storeId=&date=` |

**What Super Admin cannot currently do:**
- See any historical data (only today via modal)
- See a store-first view (all views are owner-first)
- See any platform-wide completion rates
- See which stores have had no activity today
- See employee counts per store or platform-wide
- See a trend chart for any store or the platform
- Track when admins last logged in
- Audit what actions they themselves have taken

**Backend endpoints currently available to `SUPER_ADMIN` role:**
- `GET /api/owners` — flat owner+store list
- `GET /api/owners/next-store-code`
- `GET /api/owners/reassignable-stores`
- `POST /api/addowners`
- `POST /api/owners/{id}/stores`
- `PATCH /api/owners/{id}/status`
- `PATCH /api/owners/{id}/stores/{storeId}/status`
- `GET /api/checklist-history/detail?storeId=&date=` (added in single-store migration; uses `getDetailForSuperAdmin`)
- `GET /api/checklist-history/summary` — **currently restricted to OWNER_ADMIN only**; needs to be extended

**Data already in schema, not surfaced to Super Admin:**
- `users.created_at` — admin account creation date
- `users.active` — admin active flag
- `store_employees` — employee records per store (employee count per store computable today)
- `task_response_entries` — all completion history (already used for owner's History page)

---

## Part 3 — Navigation Structure

Replace the single-item nav with five top-level sections:

```
NForce RetailOps
├── Home          (LayoutGrid icon)   — platform overview dashboard
├── Admins        (Users icon)        — admin account management
├── Stores        (Store icon)        — store-centric list + drill-in
├── History       (Clock icon)        — cross-store checklist history
└── Settings      (Settings icon)     — super admin profile/account
```

**Rationale for each:**

- **Home** — the morning launch point. Operational intelligence, not account management. Tells Super Admin "what needs my attention right now."
- **Admins** — replaces "Owners" label (which was already inaccurate; these are Admins, not store owners in the retail sense). Focused purely on account management: who they are, their status, their assigned store. Not where you go to check completion rates.
- **Stores** — a store-first view. Complements Admins by flipping the axis: instead of "admin → their store," it's "store → its admin and status." First-class nav destination, not a nested section inside an admin card.
- **History** — Super Admin needs the same cross-store historical view the Owner Admin has (their `History` page). Currently absent. Should use the existing `ChecklistHistoryService` infrastructure once the SUPER_ADMIN role is added to the `/summary` endpoint.
- **Settings** — Super Admin's own profile (name, password). Mirrors Owner Admin's Settings tab. Currently absent for Super Admin.

**Store Detail** is not a top-level nav item; it is a drill-in destination reached from Stores (or from a link in Admins). In the hand-rolled state machine, this means a `selectedStoreId: number | null` state alongside `activeTab`. When a store is selected, the page renders `SuperAdminStoreDetail` instead of `SuperAdminStores`, with a back-navigation button to return to Stores. This follows the same pattern as DashboardShell's `activeTab` switch.

```typescript
// navigation.ts addition
export type SuperAdminNavTabKey = 'home' | 'admins' | 'stores' | 'history' | 'settings';

export const SUPER_ADMIN_NAV_ITEMS: NavItem<SuperAdminNavTabKey>[] = [
  { key: 'home',     label: 'Home',     icon: LayoutGrid },
  { key: 'admins',   label: 'Admins',   icon: Users },
  { key: 'stores',   label: 'Stores',   icon: Store },
  { key: 'history',  label: 'History',  icon: Clock },
  { key: 'settings', label: 'Settings', icon: Settings },
];
```

---

## Part 4 — Home Dashboard Design

**Purpose:** Super Admin opens this every morning to answer: "What needs my attention across the platform right now?"

### Stat row (top, 4 cards)

| Card | Value | Source |
|---|---|---|
| Active Stores | count of stores with `store_owners.active = true` | New endpoint |
| Active Admins | count of users with OWNER_ADMIN role and `users.active = true` | Existing `/api/owners` or new endpoint |
| Platform Employees | sum of all active employees across all stores | New endpoint |
| Today's Completion | weighted % across all active stores | New endpoint — aggregate of ChecklistHistoryService |

All four derive from a single `GET /api/super-admin/stats` endpoint that runs four queries and returns a flat DTO. Fetched once on mount.

### Stores At Risk (flagged widget, most prominent)

A dedicated card, visually differentiated (amber/red border or tinted background), listing stores that need attention today. Two categories:

**No activity today** — stores with zero task responses for today's date. Red badge. These are the most urgent flag: the checklist may not have been touched at all.

**Low completion** — stores with at least some responses but below a threshold (e.g. < 60% complete with the working day past 4pm). Amber badge.

Each row: store name, assigned admin name, "View Details" link. If all stores are on track, show a green "All stores on track today" state.

Source: `GET /api/super-admin/stores/today` — returns per-store completion summary for today (reuses ChecklistHistoryService logic but scoped to all active stores, not one owner's stores).

### Cross-store completion bar chart

One bar per active store, showing today's completion percentage. Same Recharts `BarChart` pattern used in `Home.tsx`. Clicking a bar navigates to that store's detail. Y-axis 0–100%, X-axis store names (truncated if long). Good for comparing stores at a glance.

Source: same `/api/super-admin/stores/today` response.

### 7-day platform trend line

Same `LineChart` pattern from `Home.tsx` but aggregated across all stores. Shows platform-wide completion % for the last 7 days. Reveals whether there's a declining pattern worth acting on. Source: `GET /api/checklist-history/summary` extended to accept `storeIds=all` or a dedicated `GET /api/super-admin/history/trend?days=7`.

### Recent activity feed

A chronological list of platform-level events, newest first:
- Owner/Admin account created
- Owner account activated / deactivated
- Store assigned to admin
- Store activated / deactivated
- Password reset sent

Each entry: icon, description (e.g. "Scoopshire Store deactivated by Super Admin"), timestamp formatted as relative ("2 hours ago") for recent events or absolute date for older ones.

**Implementation note:** This requires a new `platform_activity_log` table (lightweight — event type, affected entity, actor, timestamp). The Super Admin actions that already exist (`setOwnerActive`, `setStoreActive`, `addOwner`, `assignStore`) each produce one log entry. Source: `GET /api/super-admin/activity?limit=20`.

This is the one feature on the Home page that requires a new migration. If deferred to a later phase, the feed section can show a "Coming soon" placeholder without blocking the rest of the dashboard.

---

## Part 5 — Admins Section

**Purpose:** Account management. Who are the admins, what's their status, what store are they running? Actions: create, activate/deactivate, view their store, trigger password reset.

This is the current Owners page, renamed and restructured as a proper table rather than a card list.

### Layout

**Header row:** "Admins" title, admin count badge, "Add Admin" button (current "Add Owner" flow, unchanged), search input (by name or email).

**Filter bar (below header):** Status filter (All / Active / Inactive). Simple — no need for more at this scale.

**Table (one row per admin):**

| Column | Content | Notes |
|---|---|---|
| Admin | Avatar initials + full name, email below | Same initials pattern as OwnerCard |
| Store | Store name + store code; "—" if no store | Clickable — navigates to Store Detail |
| Status | Active / Inactive badge | |
| Since | Account creation date (`users.created_at`) | Formatted as "Mar 2025" |
| Last Login | Relative timestamp ("3 days ago") or "Never" | Requires `last_login_at` column (Phase 4) |
| Actions | Three-dot menu (RowActionsMenu pattern): Activate/Deactivate, Reset Password, View Store | |

**Empty/loading states:** Loading skeleton rows (or existing "Loading owners..." pattern), empty state with "No admins yet. Add one to get started."

**Pagination:** Same Pagination component already in the codebase. Reasonable page size (20 rows). Not needed at 2-store scale but designed in from the start so it doesn't have to be bolted on later.

**Actions:**
- Activate/Deactivate: ConfirmDialog → existing `PATCH /api/owners/{id}/status`
- Reset Password: Triggers `POST /api/auth/forgot-password` on behalf of the admin (or a dedicated super-admin-initiated reset endpoint). Confirmation dialog: "Send a password reset email to {email}?"
- View Store: Navigates to Store Detail for their assigned store
- Add Admin: Current OwnerFormModal, unchanged
- Add Store (for admins without a store): Currently the disabled button in OwnerCard — in the new design, exposed as a table row action

**What moves out:** Store-level controls (toggle store active/inactive) move to the Stores section. The Admins section is admin-account-only. OwnerCard's store row toggles disappear here.

---

## Part 6 — Stores Section

**Purpose:** Store-first view of the platform. One row per store, independent of which admin runs it.

### Layout

**Header:** "Stores" title, active store count badge, search input (by store name, location, or code), Status filter (All / Active / Inactive).

**Table (one row per store):**

| Column | Content | Notes |
|---|---|---|
| Store | Store name + code (#1001), location below | |
| Admin | Admin's full name; "Unassigned" if no active admin | Clickable — navigates to Admins section filtered to that admin |
| Today | Completion % mini-bar + percentage text; "No data" if no tasks | Color-coded: green ≥ 80%, amber 40–79%, red < 40% |
| Status | Active / Inactive toggle (Toggle component, same as OwnerCard's store rows) | |
| Actions | View Details button → Store Detail; three-dot: Activate/Deactivate, Reassign Admin | |

**Source:** `GET /api/super-admin/stores` — returns all stores with: storeId, storeName, storeCode, storeLocation, storeActive, assignedAdminId, assignedAdminName, todayCompletionPercent, todayTotalTasks, todayCompletedTasks.

This is a new endpoint. Backend joins `stores` + `store_owners` (active=true) + `users` + today's `task_response_entries`. Most of the logic exists in ChecklistHistoryService already; the new endpoint wraps it for the store-list use case.

**Empty state:** "No stores yet. Create one by adding an Admin with a store."

**Key design decision:** Store status toggle lives here (Stores section), not in Admins. A store being deactivated is a store operation, not an admin account operation.

---

## Part 7 — Store Detail Section

**Purpose:** Full operational profile for one specific store. Not a modal — a full page, first-class destination reachable from Stores, Admins, and the Home dashboard.

### Navigation into Store Detail

In the state machine, `SuperAdminShell` holds `activeTab` and a separate `selectedStoreId: number | null`. When `selectedStoreId` is non-null, the main content area renders `SuperAdminStoreDetail` instead of whichever tab is active. A breadcrumb/back button ("← Stores" or "← Admins") clears `selectedStoreId`.

### Page Layout

**Page header (not app header — an in-page header):**
- Store name (H1), store code badge, location, Active/Inactive status badge
- Actions row: Activate/Deactivate Store, Reassign Admin, View Today's Checklist (opens existing ChecklistHistoryDetailModal)

**Two-column layout (desktop), single-column (mobile):**

**Left column — Info cards:**

*Assigned Admin card*
- Admin name, email (mailto link), avatar initials
- Account status badge
- "View Admin Profile" link → navigates to Admins section, scrolled to this admin
- "Reassign Admin" action

*Employee Overview card*
- Total active employees at this store
- Employee list: name, shift, employee type, EMP-XXX ID
- Source: `GET /api/super-admin/stores/{storeId}/employees` — reuses EmployeeService query scoped to this store, Super Admin read-only access

*Store info card*
- Store code, location, creation date (if tracked), active since

**Right column — Operational data:**

*Today's Completion card*
- Large completion % with donut chart (same pattern as Home.tsx)
- Total tasks / Completed / Exceptions count
- "View Checklist Detail" button → opens ChecklistHistoryDetailModal

*7-day trend chart*
- LineChart, completion % per day, last 7 days
- Same Recharts LineChart pattern from Home.tsx
- Source: `GET /api/checklist-history/summary?storeIds={storeId}&startDate=&endDate=` — this endpoint already exists but is currently OWNER_ADMIN only. After adding SUPER_ADMIN access, no new endpoint needed.

*History calendar*  
Not the full calendar UI (that's Phase 5) — in Phase 3, a simple 30-day table: one row per day, columns: date, total tasks, completed tasks, exceptions, completion %. Clicking a date row opens ChecklistHistoryDetailModal for that day. Source: same `/summary` endpoint with a 30-day window.

---

## Part 8 — Additional Professional Features (Beyond PRD)

### Feature A — Cross-store Completion Leaderboard

**What:** On the Home dashboard, a ranked list of stores sorted by today's completion %. Best-performing at top, worst at bottom. Each row shows store name, admin name, %, and a mini horizontal bar.

**Why it matters:** At multi-location scale, a leaderboard creates healthy visibility. A store that's consistently at the bottom of the platform is a signal the admin needs support or attention, not just a metric to ignore. The data already exists in the system — this is purely a presentation addition on top of the stores-today endpoint.

**Backend impact:** None — uses the same `/api/super-admin/stores/today` response, sorted client-side.

### Feature B — Platform-wide CSV/PDF Export

**What:** On the History section, an "Export" button that generates a CSV or PDF of the current view's data (cross-store summary for a date range, or per-store detail for a specific day).

**Why it matters:** Platform owners often need to share compliance data with stakeholders, franchisors, or auditors. The existing `html2canvas + jsPDF` pattern already exists in the codebase (used for owner-level exports). Extending it to Super Admin's History view requires only a button and a print layout — no new backend needed for CSV-style flat exports since the data is already in the frontend.

**Backend impact:** A `GET /api/super-admin/history/export?format=csv&startDate=&endDate=` endpoint could provide server-side CSV generation as an alternative to client-side rendering. Deferred to Phase 5.

### Feature C — Super Admin Audit Log

**What:** A log of all actions taken by Super Admin: owner created, store deactivated, status changed, etc. Viewable in a dedicated "Audit Log" subsection (could be nested under Settings or a separate nav item added in Phase 5). Each entry: action type, affected entity, timestamp, before/after status.

**Why it matters:** When something goes wrong ("why was Scoopshire deactivated last Tuesday?"), Super Admin needs an answer. Without a log, the answer requires database archaeology. At low volume (2 stores, single super admin), the log stays small and simple — but the habit of logging admin actions is much cheaper to establish now than to bolt on later.

**Backend impact:** New migration: `platform_activity_log` table (action_type VARCHAR, actor_email TEXT, entity_type VARCHAR, entity_id BIGINT, entity_name TEXT, metadata JSONB, occurred_at TIMESTAMPTZ). New `AuditLogService` with a `log(actionType, entityType, entityId, entityName)` method. Called from `OwnerManagementService` at each mutating operation. New endpoint: `GET /api/super-admin/audit-log?limit=50&offset=0`.

This is the same "Recent Activity" feed proposed for the Home dashboard — the log is the source, the feed is one view of it.

### Feature D — Global Search

**What:** A search bar in the Super Admin header (or a dedicated search overlay triggered by Cmd+K) that searches across admin names, emails, store names, and store codes. Results grouped by type (Admin, Store). Clicking a result navigates to the Admins or Stores section and highlights the matching row.

**Why it matters:** As the platform grows (even from 2 to 5 stores), scrolling a list to find a specific admin or store becomes tedious. Global search with keyboard shortcut is a professional-product expectation. The `SearchInput` component already exists; this is a data layer question.

**Backend impact:** `GET /api/super-admin/search?q={query}` returning admin matches and store matches in a single response. Or purely client-side: the full owner list (`/api/owners`) and store list (`/api/super-admin/stores`) are small enough to search in memory without a dedicated endpoint.

### Feature E — Completion Trend Alerts

**What:** A passive alerting system: if a store's 7-day average completion drops more than 20 percentage points from the prior 7-day average, the Home dashboard flags it with an amber banner ("Scoopshire's completion dropped from 82% to 58% this week — check in with Praveen"). Not a push notification — a calculated status surfaced on next login.

**Why it matters:** Without trend context, a 60% completion rate looks fine in isolation but catastrophic if last week was 85%. The existing `ChecklistHistoryService` already computes per-day completion — adding a 14-day window query and a delta calculation is modest work. This transforms Super Admin from a reactive auditor to a proactive platform manager.

**Backend impact:** Either a computed field on the `/api/super-admin/stores/today` response (`weekOverWeekDelta: -22`), or a separate `GET /api/super-admin/alerts` endpoint. No new migration needed — derived from existing `task_response_entries` data.

---

## Part 9 — Scope & File Impact

### Backend

**New controllers (or additions to SuperAdminController):**

| Endpoint | Controller | Notes |
|---|---|---|
| `GET /api/super-admin/stats` | SuperAdminController or new SuperAdminDashboardController | Platform-wide totals |
| `GET /api/super-admin/stores` | SuperAdminController | All stores + admin + today completion |
| `GET /api/super-admin/stores/today` | SuperAdminController | Per-store today's completion |
| `GET /api/super-admin/stores/{storeId}` | SuperAdminController | Store detail: admin, employees, metadata |
| `GET /api/super-admin/stores/{storeId}/employees` | SuperAdminController | Employee list for this store (read-only) |
| `GET /api/super-admin/activity` | SuperAdminController | Recent platform activity (Phase 3) |
| `GET /api/super-admin/audit-log` | SuperAdminController | Full audit log (Phase 5) |

**Existing endpoints requiring role extension:**

| Endpoint | Current role | Change needed |
|---|---|---|
| `GET /api/checklist-history/summary` | OWNER_ADMIN | Add SUPER_ADMIN; service needs a `getSummaryForAllStores(storeIds, startDate, endDate)` method that doesn't scoped to a single ownerId |
| `GET /api/checklist-history/detail` | OWNER_ADMIN + SUPER_ADMIN | Already done in single-store migration |

**New DTOs:**
- `PlatformStatsResponse.java` — {activeStores, activeAdmins, totalEmployees, todayCompletionPercent}
- `StoreListItemResponse.java` — {storeId, storeCode, storeName, storeLocation, storeActive, assignedAdminId, assignedAdminName, todayCompletionPercent, todayTotalTasks, todayCompletedTasks, weekOverWeekDelta (Phase 5)}
- `StoreDetailResponse.java` — {store metadata, admin info, employeeCount, activeEmployees}
- `AdminListItemResponse.java` — {ownerId, ownerName, ownerEmail, ownerActive, createdAt, lastLoginAt (Phase 4), storeId, storeName, storeCode}
- `PlatformActivityEntry.java` — {actionType, entityName, entityType, occurredAt, description} (Phase 3)

**New services:**
- `SuperAdminDashboardService.java` — orchestrates the new read-only queries; queries StoreRepository, StoreOwnerRepository, StoreEmployeeRepository, TaskResponseEntryRepository directly (no owner-scoped filters)
- `AuditLogService.java` (Phase 3) — writes and reads `platform_activity_log`

**New migrations:**
- `V28__platform_activity_log.sql` — `platform_activity_log` table (Phase 3)
- `V29__user_last_login.sql` — `users.last_login_at TIMESTAMPTZ` column (Phase 4)

**Modified services:**
- `ChecklistHistoryService.java` — add `getSummaryForAllStores` (no owner-scoping); called by the extended `/summary` endpoint for SUPER_ADMIN
- `OwnerManagementService.java` — add `log(...)` calls at each mutating method (Phase 3)

### Frontend

**New files:**

| File | Purpose |
|---|---|
| `src/layouts/SuperAdminShell.tsx` | Replaces inline SuperAdminDashboard; owns nav state + selectedStoreId; renders correct page per activeTab |
| `src/pages/SuperAdminHome.tsx` + `.css` | Home dashboard — stat row, stores-at-risk, bar chart, trend line, activity feed |
| `src/pages/SuperAdminAdmins.tsx` + `.css` | Admins table (current OwnerList replaced with table layout) |
| `src/pages/SuperAdminStores.tsx` + `.css` | Stores table — store-first view |
| `src/pages/SuperAdminStoreDetail.tsx` + `.css` | Full store detail page — admin card, employees, trend chart, history table |
| `src/pages/SuperAdminHistory.tsx` + `.css` | Cross-store history with date range picker (mirrors owner's History.tsx) |
| `src/pages/SuperAdminSettings.tsx` + `.css` | Super Admin profile (name, password change) |
| `src/api/superAdmin.ts` | New API functions for all new endpoints |
| `src/types/superAdmin.ts` | Types for new DTOs |

**Modified files:**

| File | Change |
|---|---|
| `src/types/navigation.ts` | Expand `SuperAdminNavTabKey` to 5 values; update `SUPER_ADMIN_NAV_ITEMS` and `SUPER_ADMIN_PAGE_TITLES` |
| `src/pages/SuperAdminDashboard.tsx` | Either: (a) rename to SuperAdminAdmins and strip non-admin concerns, or (b) delete and absorb into SuperAdminShell+SuperAdminAdmins |
| `src/App.tsx` | Change `<SuperAdminDashboard>` to `<SuperAdminShell>` — one-line change |
| `src/components/OwnerList.tsx` | May be retired if the Admins page moves to a table layout; or retained as a fallback |
| `src/components/OwnerCard.tsx` | May be retired once Admins uses a table |
| `src/api/owners.ts` | No changes to existing functions; new functions go in `src/api/superAdmin.ts` |

**Reused as-is (no changes):**
- `OwnerFormModal` — still used for "Add Admin" in SuperAdminAdmins
- `AssignStoreModal` — still used for admin-to-store assignment
- `ChecklistHistoryDetailModal` — still used for "View Checklist" in Store Detail
- `ConfirmDialog` — used throughout
- `StatCard` — reused in SuperAdminHome
- `ChartCard` — reused in SuperAdminHome and SuperAdminStoreDetail
- `SearchInput` — reused in Admins and Stores
- `Pagination` — reused in table pages
- `Toggle` — reused in Stores table for store status

---

## Part 10 — Phased Implementation Order

### Phase 1 — Shell Restructure + Nav (1 session, frontend-only)

**Goal:** Super Admin has a proper 5-tab nav and a shell that routes between pages. No new data — placeholder pages are fine for tabs that aren't implemented yet.

1. Update `navigation.ts` — 5 nav items, page titles
2. Create `SuperAdminShell.tsx` — owns `activeTab`, `selectedStoreId`, renders the correct page; passes down `onSelectStore` callback
3. Rename/refactor `SuperAdminDashboard.tsx` → `SuperAdminAdmins.tsx`; strip it down to admin-account management only (remove store status toggles from here, those move to Stores)
4. Add placeholder pages for Home, Stores, History, Settings (use existing `PlaceholderPage` component if it fits, or a minimal skeleton)
5. Update `App.tsx` to render `<SuperAdminShell>` instead of `<SuperAdminDashboard>`
6. **No backend changes**

**Tests to run after:** `npx vitest run` (no backend changes, frontend tests should still pass)

**Risk:** Low. Existing Admins functionality is preserved — just moved into a proper shell.

---

### Phase 2 — Home Dashboard + Stats Endpoint (1–2 sessions)

**Goal:** Super Admin opens to a real dashboard with platform stats, stores-at-risk widget, and completion bar chart.

1. **Backend:** `GET /api/super-admin/stats` returning `PlatformStatsResponse`
2. **Backend:** `GET /api/super-admin/stores/today` returning `List<StoreListItemResponse>` with today's completion per store
3. **Frontend:** `SuperAdminHome.tsx` — stat row (4 cards), Stores At Risk widget, bar chart (Recharts BarChart, one bar per store), 7-day trend line (requires extending ChecklistHistoryService to accept all-stores query — see below)
4. **Backend:** Extend `ChecklistHistoryController.getSummary()` to accept SUPER_ADMIN; add `getSummaryForAllStores()` to ChecklistHistoryService (no ownerId scoping)
5. **Frontend:** 7-day trend in SuperAdminHome uses `/api/checklist-history/summary` with all storeIds

**Deferred from Phase 2:** Activity feed (requires V28 migration + AuditLogService — Phase 3). Show placeholder "Activity feed coming soon" card.

---

### Phase 3 — Stores Section + Store Detail (2 sessions)

**Goal:** Super Admin can browse all stores in a table and drill into any store for full detail.

1. **Backend:** `GET /api/super-admin/stores` — full store list with admin name and today's completion
2. **Backend:** `GET /api/super-admin/stores/{storeId}` — store detail (admin info, employee count)
3. **Backend:** `GET /api/super-admin/stores/{storeId}/employees` — employee list (read-only)
4. **Frontend:** `SuperAdminStores.tsx` — table, one row per store, status toggle, View Details
5. **Frontend:** `SuperAdminStoreDetail.tsx` — assigned admin card, employee overview, today's completion donut, 7-day trend, 30-day history table
6. **Frontend:** Wire `selectedStoreId` in `SuperAdminShell` — clicking View Details from any page sets it and renders StoreDetail
7. **Migration V28:** `platform_activity_log` table
8. **Backend:** `AuditLogService.java` — log method called from OwnerManagementService
9. **Backend:** `GET /api/super-admin/activity` endpoint
10. **Frontend:** Activity feed card in SuperAdminHome (replaces Phase 2 placeholder)

---

### Phase 4 — History Section + Enhanced Admins (1 session)

**Goal:** Super Admin has cross-store history view; Admins table gains creation date and password reset trigger.

1. **Frontend:** `SuperAdminHistory.tsx` — date range picker + cross-store summary table (mirrors owner's `History.tsx` but calls the extended `/summary` endpoint)
2. **Backend:** Trigger password reset on behalf of admin — either reuse existing `POST /api/auth/forgot-password` (admin-initiated from their own email) or add `POST /api/super-admin/admins/{id}/reset-password` that sends a reset email without requiring the admin to initiate it
3. **Frontend:** "Reset Password" action in Admins table row menu
4. **Migration V29:** `users.last_login_at TIMESTAMPTZ` column
5. **Backend:** Update `AuthService.login()` to write `last_login_at` on successful login
6. **Frontend:** Show Last Login column in Admins table

---

### Phase 5 — Advanced Features (Multiple sessions, lower priority)

**Goal:** Completion trend alerts, global search, CSV export, audit log page.

1. Completion trend alerts (week-over-week delta on `/api/super-admin/stores/today`)
2. Alert banner on Home if any store is trending down significantly
3. Global search (`Cmd+K` overlay or header search bar)
4. CSV export on History section
5. Audit Log section in Settings (table view of `platform_activity_log`)
6. Cross-store leaderboard widget on Home

---

## Appendix — Architectural Notes

**No routing library:** All navigation is state in `SuperAdminShell` — `activeTab: SuperAdminNavTabKey` and `selectedStoreId: number | null`. This follows the exact same pattern as `DashboardShell.tsx`. Store Detail is rendered when `selectedStoreId !== null`, regardless of `activeTab`, with a back button that clears it.

**Data fetching pattern:** Follow the existing pattern — plain `fetch` wrapped in `useEffect`, `useState` for loading/error/data, `parseErrorMessage` for error handling. No React Query. Each page fetches its own data on mount; the Shell does not pre-fetch for child pages.

**Polling:** The Home dashboard's "Stores At Risk" widget and stat row are good candidates for a 60s polling interval (the same interval used elsewhere in the codebase) since they're operational data that changes during the day. Other sections (Admins, Stores, Store Detail) fetch once on mount.

**ChecklistHistoryService — SUPER_ADMIN extension:** The existing `resolveStores(ownerId, requestedStoreIds)` method is owner-scoped. A new `resolveAllStores(requestedStoreIds)` method (no ownerId) is needed for Super Admin access. It simply calls `storeRepository.findAllById(requestedStoreIds)` (or `findAll()` when none specified) without the ownership check. The rest of the service logic (`getSummary`, `getDetail`) is unchanged.

**Security:** All new `/api/super-admin/**` endpoints are `@PreAuthorize("hasRole('SUPER_ADMIN')")`. The employee list endpoint must be read-only for Super Admin — Super Admin cannot add or modify employees (that remains owner-scoped). Explicit `@PreAuthorize` on each endpoint rather than class-level, since SuperAdminController currently maps mixed-concern endpoints.

**DB scale:** At "2-store scale" (CLAUDE.md), every query in this design runs in milliseconds. The `MAX_OWNER_LISTING_ROWS = 500` guard in OwnerManagementService is sufficient. No pagination needed at the backend for the new endpoints at current scale — return all results and let the frontend paginate the table if needed.
