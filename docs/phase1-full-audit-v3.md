# NForce RetailOps — Phase 1 Implementation Audit (v3)

**Date:** 2026-09-04  
**Branch:** vigneshdev  
**DB:** Neon (V30 applied), codebase migrations V29 (V25 gap noted)  
**Audit scope:** Full PRD V1.0 coverage — analysis only, no code changes

---

## Summary & Current Status

**Overall phase 1 completion: ~72%**

Core infrastructure (auth, roles, task engine, employee checklist, admin history, super admin management) is solid and production-grade. The main remaining risks are:

1. **ONE_TIME schedule type missing** — tasks that run once can't be created; any PRD use case requiring it is blocked
2. **Raise issue is a stub** — `raiseIssue()` on the frontend resolves after a 200ms setTimeout with no backend call; employees think they're submitting but nothing is stored
3. **Settings page is a placeholder** — visible in nav, shows "coming soon" shell
4. **No login rate limiting** — brute-force on `/api/auth/login` unprotected
5. **Help & Guidance is a placeholder** — shown in every role's profile menu, but no content

The navigation/UI parity work done in this session (SuperAdmin bottom nav, avatar thread, Help overlay) resolved the biggest UI regression. All other visual design deliverables are complete.

---

## Ranked Priority List

| # | Item | Severity | Effort |
|---|------|----------|--------|
| 1 | ONE_TIME schedule type | HIGH | Medium (enum + matcher + migration + UI) |
| 2 | Raise Issue — real backend | HIGH | Medium (table + endpoint + frontend) |
| 3 | Login rate limiting | HIGH | Low (Spring filter or Bucket4j) |
| 4 | Settings page implementation | MEDIUM | High (depends on what goes there) |
| 5 | TEXT response validation — allow punctuation | MEDIUM | Low (regex change + migration note) |
| 6 | PDF export — jsPDF implementation | MEDIUM | Medium (html2canvas + jsPDF wiring) |
| 7 | Help & Guidance content | LOW | Low (static content) |
| 8 | DB housekeeping — V25 gap, V30 in codebase | LOW | Low |

---

## Part 2 — Authentication & Security

| Item | Status | Notes |
|------|--------|-------|
| JWT stateless auth (jjwt + bcrypt) | ✅ | `SecurityConfig`, `JwtAuthenticationFilter`, `JwtService` — correct |
| Three-role model: EMPLOYEE / OWNER_ADMIN / SUPER_ADMIN | ✅ | `User` + `Role` pair, separate detail entities per role |
| Forced password reset on first login | ✅ | `mustResetPassword` flag, `ResetPasswordRequired` page gate |
| In-app password change (current password verified) | ✅ | `POST /api/auth/change-password`, bcrypt verify before update |
| Password reset via email (tokenised, rate-limited) | ✅ | `PasswordResetService` — DB-backed, max 3 tokens/email/hour |
| Session invalidation on deactivation | ✅ | `SessionService.invalidateAllForUser()` called at `EmployeeService:299,322,346`; `AppUserDetails.isEnabled()` = `user.isActive()` blocks next request |
| Inactivity timeout (server-configured) | ✅ | `GET /api/auth/session-config`, `SessionService.getInactivityTimeoutMinutes()`, frontend timer |
| Cross-tab logout | ✅ | `localStorage` storage event listener in `App.tsx` |
| **Login brute-force / rate limiting** | ❌ | `POST /api/auth/login` has zero rate limiting. No `@RateLimiter`, no Bucket4j, no filter. Only password-reset has a rate limit. |

**Biggest risk:** `login` endpoint is wide open. An attacker can try unlimited passwords per second with no lockout or slowdown. Fix: Spring filter that tracks per-IP attempt count, or Bucket4j `@RateLimiter` on the controller method.

---

## Part 3 — Task / Schedule System

| Item | Status | Notes |
|------|--------|-------|
| EVERY_DAY schedule | ✅ | `ScheduleType.EVERY_DAY`, handled in `TaskScheduleMatcher` |
| WEEKDAYS schedule | ✅ | `ScheduleType.WEEKDAYS` |
| WEEKENDS schedule | ✅ | `ScheduleType.WEEKENDS` |
| SELECTED_DAYS schedule | ✅ | `ScheduleType.SELECTED_DAYS`, `selectedDays` column |
| **ONE_TIME schedule** | ❌ | `ScheduleType` enum only has 4 values — ONE_TIME is absent. `TaskScheduleMatcher` has no branch for it. DB column `selected_days` also has no ONE_TIME semantics. PRD requires this for ad-hoc tasks. |
| YES_NO response type | ✅ | `ResponseType.YES_NO` |
| DONE_NOT_DONE response type | ✅ | `ResponseType.DONE_NOT_DONE` |
| NUMERIC response type | ✅ | `ResponseType.NUMERIC`, `valueNumeric` column |
| TEXT response type | ✅ | `ResponseType.TEXT`, `valueText` column (TEXT in DB) |
| **TEXT input — character validation** | ⚠️ | `TaskService`: `ALPHANUMERIC_WITH_SPACES = Pattern.compile("^[A-Za-z0-9 ]*$")`, `SHORT_TEXT_MAX_LENGTH = 25`. Apostrophes, commas, hyphens, and all punctuation are rejected. A store manager entering "Milk 2% - checked" or "Don't open" fails validation silently. Fix: broaden regex to `^[\p{L}0-9 \-',.!?()&%+/]*$` or similar. |
| SINGLE completion type | ✅ | Race-condition-safe via V19 partial unique index |
| MULTIPLE completion type | ✅ | Multiple active responses allowed, all responders shown |
| Admin-only task CRUD | ✅ | `@PreAuthorize("hasRole('OWNER_ADMIN')")` on `TaskController` |
| Task `response_note` field | ✅ | V10 migration adds `response_note TEXT` on `tasks` table — admin-authored guidance per task |
| Task display order | ✅ | V15 migration adds `display_order` column |

---

## Part 4 — Employee Checklist (Daily Flow)

| Item | Status | Notes |
|------|--------|-------|
| Daily checklist generation per store/date | ✅ | `GET /api/me/tasks?storeId=` via `TaskScheduleMatcher` |
| Response submission | ✅ | `POST /api/me/tasks/{taskId}/responses` |
| Undo response | ✅ | `POST /api/me/tasks/{taskId}/responses/{responseId}/undo` — soft-inactivates row, preserves history |
| Store scoping enforced on submit | ✅ | `storeId` param enforced in `TaskService`, store ownership validated |
| MULTIPLE task — completed-by count and names | ✅ | `completedByCount`, `completedByNames` in checklist response |
| SINGLE task — race-condition protection | ✅ | DB unique index (V19) on `(task_id, store_id, response_date)` WHERE `active AND completion_type='SINGLE'` |
| Deactivated employee blocked on every request | ✅ | `AppUserDetails.isEnabled()` gates every request; sessions also revoked via `invalidateAllForUser` |
| **Raise Issue — employee-to-owner flag** | ❌ | `raiseIssue()` in `frontend/src/api/tasks.ts:61` is a stub: `// TODO: replace with a real "raise issue with owner" endpoint`. Resolves after 200ms with no HTTP call. No backend endpoint, no DB table, no storage. Employee sees modal and "success" but nothing is recorded. |
| ISSUE status in history | ⚠️ | ISSUE is derived: a YES_NO response where `valueBoolean = false`. This is not an explicit employee-raised flag — it is inferred from task answers. The PRD's "raise issue" concept (freetext note to owner) is separate and not implemented. |
| Employee personal history view | ✅ | `GET /api/me/history/detail` + `EmployeeHistory` component |

---

## Part 5 — Admin / Owner Dashboard

| Item | Status | Notes |
|------|--------|-------|
| Employee CRUD | ✅ | Create (with temp password email), update name/email/phone, deactivate (with session invalidation), store assignment |
| Category management | ✅ | Create, rename, reorder, soft-delete; CategoryNameExistsException handled |
| Task management | ✅ | Full CRUD, all schedule/response/completion types (except ONE_TIME) |
| Home dashboard with stats | ✅ | `Home.tsx` — 275 lines, shows store stats, employee count, task count, category count |
| Store detail view | ✅ | `StoreDetail.tsx` |
| History / Daily Operations Report | ✅ | `ChecklistHistoryService`, date range, store filter, per-task detail rows |
| History — CSV export | ✅ | `buildOperationsReportCsv()` in `operationsReportExport.ts`, `downloadCsv()` util |
| **History — PDF export** | ⚠️ | `html2canvas@^1.4.1` and `jspdf@^2.5.2` are installed in `package.json`. The `handlePrintReport()` function in `History.tsx:126` calls `window.print()` only. No jsPDF code anywhere in the codebase. Packages installed but feature implemented as browser print (no custom PDF layout, no filename, no formatting control). |
| History — print CSS layout | ✅ | `history-page__print-only` and `history-page__no-print` classes, print media query in History.css |
| **Admin correction of employee responses** | ❌ | `ChecklistHistoryDetailModal` is read-only (113 lines, no edit actions). `TaskResponseEntry` has no admin-override fields. No API endpoint for admin response correction. PRD item: admin corrects a wrong response after the fact — not implemented. |
| 90-day history window cap | ✅ | `MAX_DATE_RANGE_DAYS = 92` in `ChecklistHistoryService` |
| **Settings page** | ❌ | `Settings.tsx` renders `<PlaceholderPage title="Settings" icon={SettingsIcon} />` — no content, no functionality |
| ProfileMenu Settings navigation | ✅ | Settings item in ProfileMenu navigates to settings tab (Owner/Admin only) |

---

## Part 6 — Super Admin Layer

| Item | Status | Notes |
|------|--------|-------|
| Owner CRUD (add with temp password) | ✅ | `addOwner()`, `OwnerFormModal`, temp password popup |
| Owner activate / deactivate | ✅ | `setOwnerStatus()`, confirm dialog, nfToast feedback |
| Store assignment to owner | ✅ | `assignStore()`, `AssignStoreModal` |
| Store activate / deactivate | ✅ | `setStoreStatus()`, confirm dialog |
| Single-store-per-owner enforcement | ✅ | V27 migration, backend guard — each owner can manage exactly one store |
| Super Admin employees page | ✅ | `SuperAdminEmployees.tsx` — cross-owner directory, read-only |
| Super Admin stores page | ✅ | `SuperAdminStores.tsx` |
| Checklist drill-in from owner row | ✅ | `ChecklistHistoryDetailModal` opens for store/date from owner list |
| Super Admin stats (owners, stores) | ✅ | `StatCard` row: Total Owners, Active Owners, Total Stores |
| **Global UI parity (nav, avatar, profile overlay)** | ✅ | Fixed in this session: `mobileNav="bottom-tabs"`, avatar threaded through `App.tsx → SuperAdminDashboard → AppShell`, Help overlay added, profile overlay parity |
| Bottom pill nav — all 3 roles | ✅ | Employee: EmployeeShell, Owner/Admin: DashboardShell, SuperAdmin: SuperAdminDashboard — all use `AppShell` with `mobileNav="bottom-tabs"` |
| Iridescent glass highlight on active tab | ✅ | CSS `box-shadow` ring + dark radial gradient, spring easing `cubic-bezier(0.34,1.56,0.64,1)` |

---

## Part 7 — Cross-Cutting Concerns

| Item | Status | Notes |
|------|--------|-------|
| Soft-delete / deactivation (no hard delete) | ✅ | NForce convention followed — `active` boolean on User, StoreOwner, StoreEmployee |
| Flyway migrations, `ddl-auto=validate` | ✅ | All schema changes go through `/db/migration/V{n}__*.sql` |
| Toast notification system | ✅ | `react-hot-toast` + custom `NfToast` component, 3 tones (success/error/info) |
| Dark / light theme toggle | ✅ | `IconButton` in Header, theme stored in localStorage |
| Mobile safe area insets | ✅ | `env(safe-area-inset-bottom)` in bottom nav and shell content padding |
| Inactivity session expiry message | ✅ | `INACTIVITY_MESSAGE` shown on login screen after timeout |
| **Push notifications** | ❌ | Zero implementation. No FCM/APNs integration, no backend notification service, no subscription management, no notification center UI. Not in any dependency. |
| **Help & Guidance page** | ❌ | `Help.tsx` renders `<PlaceholderPage>` with "Support docs and guided walkthroughs are coming soon." No content. Visible in ProfileMenu for all roles. |
| Password reset email delivery | ✅ | `MailService` → Resend API, `EmailDeliveryException` handled with account compensation |
| CORS from environment config | ✅ | `@Value("${app.cors.allowed-origins}")` in SecurityConfig — no hardcoded localhost |
| API base URL from env var | ✅ | `VITE_API_BASE_URL` in frontend `.env` |
| **DB version gap** | ⚠️ | V25 is missing from codebase (V24 → V26 jump). V30 was applied directly on Neon but is not in the repo migration files. Two separate debts: a naming gap and an out-of-band schema change. Low risk if Flyway's `out-of-order=false` (default) but needs reconciliation before next migration. |
| H2 test DB (backend tests) | ✅ | `application-test.yml` uses H2 PostgreSQL-compat mode, Flyway disabled for tests |
| 15s/60s polling for live data | ✅ | Used in EmployeeDashboard for checklist freshness |
| `parseErrorMessage` pattern | ✅ | Consistent across all `api/*.ts` files |
| Accessibility — ARIA roles on toasts | ✅ | `role="alert"` for errors, `role="status"` for success/info, `aria-live` set |
| Touch targets ≥ 44px | ✅ | Bottom nav items: 64px tall, icon area 44×28px; modal close buttons: 44px |

---

## Items Not in PRD But Worth Flagging

- **V10 `response_note` on tasks** — admin can write a per-task guidance note, but it's unclear if the frontend displays it to employees during checklist completion (not checked in this audit).
- **`completion_type` denormalised on `task_responses`** — intentional for V19 partial index (noted in code comment). Correct design.
- **Employee multi-store assignment exists in data model** — `StoreEmployee.getStores()` is a collection; employees can be shared across stores. But owner single-store constraint (V27) means this only matters at Super Admin level.
- **Undo only available to the employee who responded** — owner has no undo capability; correction route (admin override) is unimplemented per finding above.

---

*Report generated by code analysis — no code was changed during this audit.*
