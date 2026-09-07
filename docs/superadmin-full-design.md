# Super Admin — Full Experience Design

**Status:** Design only — no code written. Review and approve before building.  
**Branch:** vigneshdev  
**Scope:** Multi-store Daily Checklist, Home page, Notifications, additional platform features.

---

## Summary & Recommendations

Super Admin's current experience is a competent **management console** (owners, stores, employees) but has a significant gap: it provides no operational visibility into what's actually happening across the stores it manages. An admin can see that a store exists but cannot see whether today's tasks are being completed, whether issues are piling up, or whether any store is silently failing to operate.

The five highest-priority additions, in order:

1. **Cross-Store Operations Overview (Home page)** — a landing page that shows platform-wide aggregate stats plus a per-store comparison table. This is the single most time-saving addition: instead of clicking into each store one at a time, Super Admin gets a full picture on arrival.
2. **Full-featured per-store Daily Checklist** — promote the existing limited `SuperAdminStoreDetail` into a proper Daily Checklist page with store selector, date navigation, employee contributions, outstanding tasks, trend indicator, and repeat-offender flags (but not admin corrections — see Part 3).
3. **Three targeted notifications** — zero activity for a day on any store, unresolved issues ≥48 h, owner provisioning email failure. These are operationally critical and not discoverable any other way.
4. **Owner onboarding status** — surface whether a newly created owner has ever logged in and whether they have set their permanent password. A common operational gap at this level.
5. **Platform-wide search** — one unified search across all owners, stores, and employees.

---

## Part 1 — Skills

Skills paths `/mnt/skills/public/`, `/mnt/skills/private/`, `/mnt/skills/examples/`, `/mnt/skills/user/` returned no output (directories not present in this environment). The `frontend-design` plugin skill loaded in this session via the active skills system; its guidelines (distinctive point of view, no templated defaults, real subject matter) are applied to the UI proposals below.

---

## Part 2 — Current Super Admin State (exhaustive)

### 2.1 Navigation

Three nav items only, confirmed from `types/navigation.ts`:
```
owners  →  Owners table (default landing)
stores  →  Stores table
employees → Employees table
```
No Home, no Daily Checklist, no Notifications.

### 2.2 Landing Page on Login

Super Admin lands directly on the **Owners tab** — the `activeTab` state initialises to `'owners'` and there is no dedicated landing page/home. The Owners tab has three StatCards at the top (Total Owners, Active Owners, Total Stores) followed immediately by the owner table.

### 2.3 Owners Page

- Three StatCards: Total Owners, Active Owners, Total Stores
- Search bar (filters by name, email, or store name)
- Grouped owner table (`OwnerTable`) with: owner name, email, active-toggle switch, edit button, deactivate (trash) button, assigned store rows each with store name, store-active toggle, and a "View Checklist" button
- **View Checklist** opens `ChecklistHistoryDetailModal` — a modal that wraps a date-picker-lite version of the checklist for that specific store. This is a limited view (no employee contributions, no trend indicator, no corrections, no export, no outstanding-tasks panel)
- **Add Owner**: `SpecularButton` → `OwnerFormModal` → creates owner account + displays temporary password in `TemporaryPasswordPopup`
- **Assign Store**: `AssignStoreModal` adds a store to an existing owner

### 2.4 Stores Page (`SuperAdminStores`)

- StatCards: Total Stores, Active Stores, Total Employees
- Full filter bar: search, status (ALL/ACTIVE/INACTIVE), employee-count comparator, task-count comparator
- Paginated `SuperAdminStoreTable` (10 per page)
- Each row: store name, owner name, status toggle, employee count, task count, edit, delete
- **Delete** is guarded: blocked if store has any checklist history (preserves audit trail)
- **Drill-in**: Clicking a row or an explicit button opens `SuperAdminStoreDetail` — a full-page view within the tab showing date navigation (`←`, `→`, date display), filter chips (ALL/COMPLETE/OPEN/ISSUE), and `StoreDetailTable`. This is more capable than the modal in Owners but still missing employee contributions, trend indicator, repeat-offender flags, outstanding-tasks panel, export, and corrections (all blocked at backend for SUPER_ADMIN role)
- **Add Store**: `AddStoreModal` creates a standalone store (no owner assigned at creation time)

### 2.5 Employees Page (`SuperAdminEmployees`)

- StatCards: Total Employees, Active Employees, Inactive Employees
- Full filter bar: search, shift, type, status
- Paginated `SuperAdminEmployeeTable`
- Per-employee: view detail modal, edit, delete (permanent, not soft-delete), status toggle (activate/deactivate)
- Create employee as Super Admin (assigns to a specific store)

### 2.6 Profile / Help / Settings

All three overlay pages are present, wired from `AppShell`'s `onProfileClick`, `onHelpClick`, `onSettingsClick`. Profile page has full avatar-upload + edit + change-password parity (per recent work). These are handled via `showProfile`, `showHelp`, `showSettings` boolean state in `SuperAdminDashboard`.

### 2.7 Notifications — Confirmed State

**Super Admin has zero notification wiring.** Confirmed by code inspection:

- `SuperAdminDashboard` does **not** pass `onNotificationsClick`, `notificationUnreadCount`, `onNotificationsCountChange`, or `onNotificationNavigate` to `AppShell`. The bell icon is therefore not rendered.
- `NotificationController` has `@PreAuthorize("hasAnyRole('OWNER_ADMIN', 'EMPLOYEE')")` — SUPER_ADMIN is explicitly excluded from the notification API.
- `NotificationService` has no methods that create a notification targeted at a Super Admin user. All current triggers target either an owner (`STORE_DEACTIVATED`, `ACCOUNT_DEACTIVATED`, `STORE_REACTIVATED`, `ACCOUNT_REACTIVATED`) or an employee (`ISSUE_ACKNOWLEDGED`, `ISSUE_RESOLVED`, `CORRECTION_MADE`).

### 2.8 Backend Permissions Summary (relevant endpoints)

| Endpoint | SUPER_ADMIN access |
|---|---|
| `GET /api/checklist-history/detail` | ✅ Allowed (`hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')`) |
| `GET /api/checklist-history/summary` | ❌ Blocked (`hasRole('OWNER_ADMIN')`) |
| `GET /api/checklist-history/operations-summary` | ❌ Blocked (`hasRole('OWNER_ADMIN')`) |
| `PATCH /api/checklist-history/responses/{id}/correct` | ❌ Blocked (`hasRole('OWNER_ADMIN')`) |
| `GET /api/issues` | ❌ Blocked (`hasRole('OWNER_ADMIN')`) |
| `PATCH /api/issues/{id}/status` | ❌ Blocked (`hasRole('OWNER_ADMIN')`) |
| `GET /api/notifications` | ❌ Blocked (`hasAnyRole('OWNER_ADMIN', 'EMPLOYEE')`) |

---

## Part 3 — Multi-Store Daily Checklist

### 3.1 The Gap

Super Admin can view a single store's checklist in two places today (Owners modal, Stores drill-in), but both are incomplete compared to Admin's Daily Checklist. Missing across both: employee contributions, trend indicator, repeat-offender detection, outstanding-tasks panel, export. Neither provides a cross-store view. The workflow is also scattered — store checklist access lives inside two different management tabs rather than being a first-class operational page.

### 3.2 Store Selector — Default Behaviour

**Recommendation: Default to the Cross-Store Comparison view (see §3.6), not to any single store.**

Rationale: Super Admin managing multiple stores has no natural "primary" store. Defaulting to the first alphabetically or most recently viewed feels arbitrary and may cause them to miss a problem elsewhere. The comparison table — showing all active stores ranked by today's completion % and open-issue count — is the operationally correct landing state: Super Admin scans for the worst-performing store and clicks into it. This is the same mental model used by any operations lead doing a daily review.

If only one active store exists, skip the comparison table and open that store's checklist directly.

The store selector itself (once a specific store is chosen) is a `Select` dropdown at the top of the page, populated from all active stores across all owners. It persists the last-selected store in component state for the session.

### 3.3 Page vs. Modal

**Recommendation: Promote to a full nav-level page called "Operations" or "Daily Checklist".**

The current dual-entry-point modal approach (Owners → View Checklist, Stores → drill-in) is an accident of build history, not a deliberate UX decision. Neither entry point is discoverable as a primary daily workflow tool.

A dedicated nav item — fourth item in the Super Admin sidebar — makes operational review a first-class workflow step, not a detail buried inside a management table. The existing Stores-tab drill-in (`SuperAdminStoreDetail`) becomes redundant and should be replaced by a "View in Daily Checklist →" link that navigates to this new page with the store pre-selected. The Owners-tab modal can similarly route to this page.

**New nav:** `owners | stores | employees | checklist` (label: "Operations" or "Daily Checklist", icon: `ClipboardList`)

### 3.4 Feature Set — What to Carry Over

| Feature | Include? | Notes |
|---|---|---|
| Date navigation (← →, calendar picker, Yesterday/Last Week pills) | Yes | Identical to Admin's |
| Mode badge (Live / Historical) | Yes | Identical to Admin's |
| Stat tiles (Total Tasks, Completed, No Response, Completion %) | Yes | Informational only, no tile-click filter (filter lives in the status dropdown per the recent redesign) |
| Employee contributions section | Yes | Per-selected-store, same accordion UI |
| Outstanding tasks panel | Yes | Today-only, same collapsible UI |
| Trend indicator (vs. yesterday) | Yes | Per-selected-store |
| Repeat-offender flags | Yes | Per-selected-store, same 7-day cache pattern |
| Status filter dropdown (All / Completed / No Response / Issues) | Yes | Same filter bar as Admin's |
| Search + category filter | Yes | Identical |
| Admin Corrections — VIEW existing corrections | Yes | Super Admin can see the audit trail |
| Admin Corrections — MAKE a new correction | **No** | See §3.5 |
| Export (per-store PDF/CSV) | Yes | Same ExportMenu |
| Cross-store summary export | **New** | See §3.5 |

### 3.5 Admin Corrections — Super Admin Should View Only

**Recommendation: Super Admin can see corrections made but cannot create new ones.**

This is already enforced at the backend (`PATCH /api/checklist-history/responses/{id}/correct` requires `OWNER_ADMIN`). The reasoning is sound and should remain:

1. **Accountability chain**: Corrections carry the correcting admin's identity. A Super Admin correcting a response would inject themselves into a store's operational record — something the store owner might not expect or want.
2. **Override concerns**: A store owner may have made a deliberate operational decision (e.g. marking a task as N/A for a specific day). Super Admin overriding that silently is outside their remit.
3. **Audit clarity**: Super Admin's role is platform oversight. An admin's role is store operations. These should not overlap.

Super Admin sees the correction annotation (the blue "Corrected" badge and the correction-history drawer) but the "Correct response" action in the table is hidden/disabled for their session.

### 3.6 Cross-Store Comparison View (default state before store selection)

A read-only table showing all active stores sorted by today's completion % ascending (worst first), so the most urgent stores appear at the top. Columns:

| Column | Detail |
|---|---|
| Store name | Clickable — navigates to that store's full checklist |
| Owner name | Plain text |
| Today's Completion | % of tasks completed, colour-coded (green ≥80%, amber 60–79%, red <60%) |
| Open Issues | Count of unresolved issues; red badge if >0 |
| Last Activity | Relative time of the most recent task response today ("2 min ago", "—" if none) |
| Status | Active / Inactive badge |

This view requires a new backend endpoint: `GET /api/super-admin/stores/operations-overview?date=YYYY-MM-DD` returning all stores with per-store completion and open-issue count. This is a Super-Admin-only endpoint.

The comparison table is the default landing state of the Operations page. Once a store is selected from the dropdown, it replaces the comparison table with the full per-store checklist. A "Back to all stores" link restores the comparison view.

---

## Part 4 — Super Admin Home Page

### 4.1 Current State

Super Admin lands on the Owners table. There is no Home page.

### 4.2 Proposed Home Page

Add a **Home** nav item as the first item in the Super Admin sidebar, making the nav:

`home | owners | stores | employees | checklist`

The Home page has the same structure as Admin's Home: a row of StatCards at the top, then content sections. All tiles use the shared `StatCard` component for visual consistency.

**Stat tile row:**

| Tile | Value | Tone |
|---|---|---|
| Total Owners | `uniqueOwnerCount` (already computed) | `info` |
| Active Owners | `activeOwnerCount` (already computed) | `success` |
| Total Stores | `totalStoreCount` (already computed) | `info` |
| Platform Completion | Avg completion % across all active stores today | `warning` |
| Open Issues | Total unresolved issues across all stores | `primary` / `success` |

The "Platform Completion" tile calls a new aggregate endpoint (same data as the cross-store comparison table but aggregated to a single number). The "Open Issues" tile follows the same null-safe loading pattern implemented in the recent Admin Home fix: `useState<number | null>(null)` initialises to `null`, shows `"—"` while loading, then transitions to the real count — never a false "0" before data arrives.

### 4.3 Cross-Store Comparison Table Placement

**The comparison table lives on Home, not on the Daily Checklist page.**

The comparison table is a high-level overview — it answers "where do I need to look?" rather than "what's happening in this specific store?" That's a Home-page question. The Daily Checklist page's default state before store selection can show a simpler text prompt ("Select a store above to view its checklist") rather than the comparison table — the full table on Home already answered the "where do I go?" question.

Keeping the comparison table on Home also avoids a confusing "table inside a checklist page" layout, and means the Home page has genuinely useful content rather than just a summary of management stats.

### 4.4 Additional Widgets

**Widget 1 — Stores with Zero Activity Today (flagged list)**

A compact "Needs Attention" section listing stores where zero task responses have been recorded today. Appears only if at least one such store exists. Each row links directly to that store's checklist. This is qualitatively different from "low completion" — a store where employees haven't opened the app at all is an operational emergency, not just a performance gap.

**Widget 2 — Recent Platform Activity (mini feed)**

A short (5-item) feed showing recent significant events: new owner added, store deactivated, issue resolved after long delay. Helps Super Admin maintain situational awareness without hunting through tables. Items link to the relevant entity.

**Widget 3 — Not recommended: "Newest owners" or "Recently onboarded stores"**

This information is already accessible from the Owners/Stores tables with a sort by creation date. Adding it to Home would duplicate data without providing operational value.

---

## Part 5 — Notifications Reconsidered

### 5.1 Final Recommendation: Three Triggers, No More

After reviewing the full system (Issues, Corrections, store/account status, daily checklist, the cross-store visibility being designed here), three notification triggers are genuinely justified for Super Admin. All others should remain excluded.

**Trigger 1 — Store with Zero Task Activity for a Full Day (HIGH priority)**

- **Why it matters:** The Home page comparison table shows this, but only if Super Admin is logged in. A notification ensures they know even if they don't check the dashboard. Zero activity on any store is an operational failure, not a metric to be discovered passively.
- **When to fire:** A `@Scheduled` job runs at a fixed time (e.g. 18:00 store-local time, or 20:00 platform time as an approximation). For every active store where `totalResponses = 0` for the current date, fire one notification to all Super Admin accounts.
- **Category:** `STORE_ZERO_ACTIVITY` (new category, HIGH priority)
- **Dedup:** Only fire once per store per calendar day. Suppressed if any response exists by check time.

**Trigger 2 — Owner Provisioning Email Failure (HIGH priority)**

- **Why it matters:** When `addOwner` creates an account with a temporary password, the password is returned to Super Admin in the UI popup. However, if the system also attempts to send the password by email (e.g. using Resend), a silent failure means the owner never receives it and may never know to log in. Super Admin is the only one who can follow up.
- **When to fire:** In the owner-creation flow, if the email-send step throws (or is skipped because Resend is not configured), notify the creating Super Admin with the owner's name and the fallback instruction ("Temporary password was not emailed — share it manually").
- **Category:** `OWNER_EMAIL_FAILED` (new, HIGH priority)
- **Note:** If email is currently not attempted at all in the provisioning flow (password only shown in popup), this trigger still has value as a future-proofing guard when email delivery is added.

**Trigger 3 — Issue Unresolved for 48+ Hours (MEDIUM priority)**

- **Why it matters:** Super Admin has no visibility into issues across stores — `GET /api/issues` is currently OWNER_ADMIN-only. An issue that an employee raised but the store admin has ignored for 48+ hours represents a breakdown in the oversight chain that Super Admin is responsible for maintaining.
- **When to fire:** A `@Scheduled` job runs daily (e.g. 09:00). For every `RaisedIssue` with `status = 'OPEN'` and `createdAt < now - 48h`, fire one notification per Super Admin per store (not per individual issue — aggregate to avoid spam: "River way - Store 2 has 3 issues open for more than 48 hours").
- **Category:** `ISSUES_OVERDUE` (new, MEDIUM priority)
- **Dedup:** Fire only if not already notified for that store's overdue count today.

### 5.2 Triggers Considered and Excluded

| Trigger | Decision | Reason |
|---|---|---|
| Store deactivated (Super Admin's own action) | Excluded | Super Admin did it — they know |
| Owner account deactivated | Excluded | Same — Super Admin's own action |
| New employee joined a store | Excluded | Store-level event, not platform oversight |
| Low completion % (e.g. <50%) | Excluded | Completion % already visible on Home; a threshold notification would be noisy and subjective |
| Admin made a correction | Excluded | Store-level event; Super Admin can see corrections when viewing that store's checklist |
| New issue raised at any store | Excluded | Too many events — Super Admin would be flooded. The 48h trigger handles genuine inaction without drowning in every issue raised |

### 5.3 Infrastructure Question

The notification system (bell icon, dropdown, full Notifications page, `NotificationBell` component, `NotificationService`, `NotificationRepository`) is **already fully built** for Owner/Admin and Employee. Super Admin needs only:

1. `NotificationController` — add `SUPER_ADMIN` to the `@PreAuthorize` annotation
2. `NotificationService` — add three new `send(...)` call sites for the new triggers
3. `SuperAdminDashboard` — wire `onNotificationsClick`, `notificationUnreadCount`, `onNotificationsCountChange` to `AppShell` (same props as `DashboardShell` already passes)
4. `SuperAdminNavTabKey` — add `'notifications'` as a tab; the Notifications page component is reused as-is

No new notification infrastructure needs to be built. The incremental cost is small relative to the value.

---

## Part 6 — Other Platform-Owner Features

### 6.1 Owner Onboarding Status (High Value, Low Cost)

**Problem:** Super Admin creates an owner with a temporary password but has no way to know whether that owner has ever logged in, whether they've changed their temporary password, or whether they're stuck.

**Proposed solution:** Add a small status indicator to the Owners table: a "Last login" column showing "Never" (red badge), a relative timestamp ("3 days ago"), or "Active today" (green). This is derivable from the existing `users` table `last_login_at` column (or one can be added in a single migration). No new page needed.

Additionally, surface whether the temporary password has been changed. The simplest approach: store a `force_password_change` boolean on the user record (set to `true` on creation, cleared on first successful password change). Show a "Must change password" badge in the Owner table for accounts where this is still true.

**Backend:** One migration adding `last_login_at TIMESTAMP` to `users` (updated on successful auth) and `force_password_change BOOLEAN` (already a common pattern). One column each in the owner-list response DTO. No new endpoint needed.

### 6.2 Platform-Wide Search (Medium Value, Medium Cost)

**Problem:** With multiple owners, stores, and employees, finding a specific entity requires knowing which table to look in and then using that table's search.

**Proposed solution:** A unified search in the Header (already has a `searchValue` / `onSearchChange` prop wired but currently unused in Super Admin). Typing triggers a debounced `GET /api/super-admin/search?q=...` returning matched owners, stores, and employees in a grouped dropdown (up to 5 per category). Clicking a result navigates to the relevant table with that entity pre-selected or highlighted.

This is medium-cost because it requires a new backend endpoint doing three queries (users by name/email, stores by name, employees by name) and a new `SearchResultsDropdown` component.

### 6.3 Super Admin Action Log (Medium Value, Medium Cost)

**Problem:** At a platform level, accountability requires knowing who created, deactivated, or modified which owner/store and when. Currently there is no record of Super Admin's own actions beyond what implicitly exists in entity timestamps.

**Proposed solution:** A simple append-only `super_admin_audit_log` table with columns: `id`, `super_admin_user_id`, `action` (enum: `OWNER_CREATED`, `OWNER_DEACTIVATED`, `OWNER_REACTIVATED`, `OWNER_UPDATED`, `STORE_CREATED`, `STORE_DELETED`, `STORE_DEACTIVATED`, `STORE_REACTIVATED`, `EMPLOYEE_CREATED`, `EMPLOYEE_DELETED`), `target_type`, `target_id`, `target_name`, `created_at`. Rows are inserted by the relevant service methods.

A minimal "Audit Log" section within the Owners or Settings page displays the last 50 entries. Not a new nav item — this is a reference tool, not a daily workflow.

**Note:** This is lower urgency if the team is the sole Super Admin and there's no compliance requirement. Flag as post-MVP.

### 6.4 Bulk Actions (Low Value Now, Medium Value at Scale)

At 2 stores, bulk deactivation of owners or stores isn't necessary. At 20+ stores, it becomes genuinely useful. This is correctly deferred. The table infrastructure (checkboxes + action bar) can be added to `OwnerTable` and `SuperAdminStoreTable` when the owner count grows meaningfully (>15 is a reasonable threshold). No design needed now.

---

## Part 7 — File Impact & Implementation Order

### 7.1 All Files Touched

**Backend — new files:**
- `V36__super_admin_audit_log.sql` (§6.3)
- `V36__last_login_and_force_password_change.sql` (§6.1, separate migration, adjust number)
- `controller/SuperAdminOperationsController.java` (§3.6 comparison endpoint, §4.2 aggregate stats)
- `dto/StoreOperationsSummary.java`
- `dto/PlatformStatsSummary.java`
- `service/SuperAdminOperationsService.java`
- `repository/SuperAdminAuditLogRepository.java` (§6.3)
- `entity/SuperAdminAuditLog.java` (§6.3)

**Backend — modified files:**
- `controller/NotificationController.java` — add `SUPER_ADMIN` to `@PreAuthorize`
- `service/NotificationService.java` — three new trigger methods (§5.1)
- `service/OwnerManagementService.java` — call audit log on owner create/update/status change
- `service/StoreService.java` — call audit log on store create/delete/status change
- `service/TaskService.java` or scheduling config — `STORE_ZERO_ACTIVITY` job (§5.1 Trigger 1)
- `dto/OwnerSummaryResponse.java` — add `lastLoginAt`, `forcePasswordChange` (§6.1)
- `security/SecurityConfig.java` — if notification endpoint needs route-level guard change (check)
- Scheduler class (new or existing `@Scheduled`) — `ISSUES_OVERDUE` job (§5.1 Trigger 3)

**Frontend — new files:**
- `pages/SuperAdminHome.tsx` + `.css`
- `pages/SuperAdminChecklist.tsx` + `.css` (full-featured per-store checklist for Super Admin)
- `components/StoreComparisonTable.tsx` + `.css` (§3.6, used on Home)
- `api/superAdminOperations.ts` (comparison endpoint, platform stats)

**Frontend — modified files:**
- `types/navigation.ts` — add `'home'` and `'checklist'` to `SuperAdminNavTabKey`; update `SUPER_ADMIN_NAV_ITEMS` and `SUPER_ADMIN_PAGE_TITLES`
- `pages/SuperAdminDashboard.tsx` — add home/checklist tab routing; wire notification props to AppShell
- `pages/SuperAdminStores.tsx` — replace drill-in with "View in Daily Checklist →" link
- `components/OwnerTable.tsx` — "View Checklist" button routes to new Checklist page instead of opening modal; add last-login/onboarding-status column (§6.1)
- `types/owner.ts` — add `lastLoginAt`, `forcePasswordChange` to `OwnerSummary`

### 7.2 Implementation Order (Phased)

**Phase 1 — Super Admin Home page (2–3 days)**
1. New migration: `last_login_at` + `force_password_change` on users
2. Update `OwnerSummaryResponse` DTO and `getOwners` endpoint to include both fields
3. New backend endpoint: `GET /api/super-admin/operations-overview?date=` (per-store completion + issue count)
4. `api/superAdminOperations.ts` — frontend API functions
5. `StoreComparisonTable` component (read-only, purely display)
6. `SuperAdminHome.tsx` — stat tiles (reuse existing owner data already loaded) + comparison table + "zero activity" section
7. Add `home` to nav items; `SuperAdminDashboard` routes to `SuperAdminHome` for `activeTab === 'home'`

Deliverable: Super Admin lands on a proper Home page with real operational data.

**Phase 2 — Full-featured Daily Checklist page (2–3 days)**
1. `SuperAdminChecklist.tsx` — store selector dropdown + date navigation + all existing Admin checklist features except corrections
2. Wire existing `StoreDetailTable`, `ExportMenu`, employee contributions, outstanding tasks, trend indicator, repeat-offender detection (all existing components, just assembled for Super Admin with the store-selector layer on top)
3. Add `checklist` to nav items; update Owners table "View Checklist" to navigate to this page
4. Update Stores drill-in to link to the Checklist page instead of the inline `SuperAdminStoreDetail`

Deliverable: Super Admin has a full-featured operational view for any store.

**Phase 3 — Notifications (1–2 days)**
1. Add `SUPER_ADMIN` to `NotificationController` `@PreAuthorize`
2. Add three new trigger methods to `NotificationService` + two new `@Scheduled` jobs
3. Wire notification bell props in `SuperAdminDashboard.tsx` — the Notifications page component is reused unchanged

Deliverable: Super Admin receives targeted operational alerts.

**Phase 4 — Owner onboarding status (1 day)**
1. Update `last_login_at` to be set on every successful auth (one line in `AuthService`)
2. Show "Last login" column + "Must change password" badge in `OwnerTable`

Deliverable: Super Admin can spot stuck owners immediately.

**Phase 5 — Platform-wide search (2 days, deferrable)**
New endpoint + `SearchResultsDropdown` component. Deliver after Phase 4 if time allows.

**Phase 6 — Audit log (deferrable)**
Backend migration + service instrumentation + minimal display in Settings or a new Log section. Post-MVP.

---

## Appendix — Backend Endpoint Summary

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/super-admin/operations-overview` | GET | SUPER_ADMIN | Per-store completion %, open-issue count, last-activity time for all active stores |
| `/api/super-admin/platform-stats` | GET | SUPER_ADMIN | Aggregate: platform completion %, total open issues (for Home stat tiles) |
| `/api/super-admin/search` | GET | SUPER_ADMIN | Unified search across owners, stores, employees |
| `/api/super-admin/audit-log` | GET | SUPER_ADMIN | Super Admin's own action history |
| `/api/notifications` | GET | OWNER_ADMIN, EMPLOYEE, **SUPER_ADMIN** | Add SUPER_ADMIN to existing endpoint |
| `/api/notifications/unread-count` | GET | OWNER_ADMIN, EMPLOYEE, **SUPER_ADMIN** | Add SUPER_ADMIN to existing endpoint |
| `/api/notifications/{id}/read` | PATCH | OWNER_ADMIN, EMPLOYEE, **SUPER_ADMIN** | Add SUPER_ADMIN to existing endpoint |

The `/api/super-admin/operations-overview` endpoint is the most critical new addition. It needs to return:
```json
[
  {
    "storeId": 3,
    "storeName": "River way - Store 2",
    "ownerName": "Praveen Kumar",
    "active": true,
    "todayCompletion": 72,
    "totalTasksToday": 18,
    "completedTasksToday": 13,
    "openIssueCount": 2,
    "lastActivityAt": "2026-09-06T14:32:00Z"
  }
]
```
This is computable from existing `checklist_history` data plus a `COUNT` on `raised_issues WHERE status = 'OPEN'`. No new schema needed — just a new service method + endpoint.
