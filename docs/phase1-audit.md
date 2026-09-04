# NForce RetailOps — Phase 1 Functional Audit

**Date:** 2026-09-03  
**Branch:** vigneshdev  
**Auditor:** Claude Code (read-only analysis — no code changed)  
**Stack:** Spring Boot 3 / Java 17 / PostgreSQL (Neon) · React + Vite + TypeScript · Railway + Vercel

---

## PART 0 — PRD PHASE 1 COMPLIANCE CHECK

Each item traced to actual controller, service, entity, or frontend component. Not assumed.

### Role Model

| Role | Status | Notes |
|------|--------|-------|
| Super Admin | ✅ | `SuperAdminController` — creates/manages owners, assigns stores, toggles owner and store-owner active status |
| Owner/Admin | ✅ | `TaskController`, `CategoryController`, `EmployeeController`, `StoreController` — all scoped to owner's data via service-layer FK checks |
| Employee | ✅ | `MeController` — checklist, response submission, undo, store selection via `StorePicker` page |

---

### Phase 1 — Daily Operations Requirements

**1. Employee login with role-based access**
✅ **Fully Implemented**
`AuthController.login()` — checks super_admin table first, then users table. Verifies `user.active`. Returns token + role. `App.tsx` routes by role to `SuperAdminDashboard`, `DashboardShell`, or `EmployeeShell`.

---

**2. Store access control — employee assigned to one or multiple stores; must choose if multi-store**
✅ **Fully Implemented**
`employee_stores` many-to-many table. `MeController.getStores()` returns assigned stores. `App.tsx` renders `StorePicker` if count > 1, `EmployeeShell` directly if count = 1. Active store ID persisted in localStorage.

---

**3. Category management — Admin can create/edit/reorder/activate/deactivate**
✅ **Fully Implemented**
`CategoryController` — CRUD + `PATCH /{id}/status`. `display_order` column on categories table; reorder updates display_order. Frontend `Categories` page confirmed to call all endpoints.

---

**4. Task management — name, description, category, store assignment, active flag, display order**
✅ **Fully Implemented**
`TaskController` — CRUD + `PATCH /{id}/status`. `tasks` table has all required columns. `task_stores` many-to-many for per-store assignment. `applies_to_all_stores` boolean for owner-wide tasks.

---

**5. Task scheduling — daily, weekdays, weekends, specific days, one-time**
⚠️ **Partially Implemented**
`ScheduleType` enum: `EVERY_DAY`, `WEEKDAYS`, `WEEKENDS`, `SELECTED_DAYS`. **`ONE_TIME` / single-occurrence is NOT in the enum.** `task_selected_days` table covers specific days. Date range (`start_date`, `end_date`) plus `TimeMode` (ANYTIME/WINDOW) are present and evaluated by `TaskScheduleMatcher`. "One-time only" would require a `ONE_TIME` schedule type and an automatic deactivation after one completion date — neither exists.

---

**6. Response types — Yes/No, Done, Number, Short Text**
✅ **Fully Implemented**
`ResponseType` enum: `YES_NO`, `DONE_NOT_DONE`, `NUMERIC`, `TEXT`. All four rendered in `EmployeeDashboard`. `task_responses` stores `value_boolean`, `value_numeric`, `value_text`. NUMERIC supports `numeric_unit`, `numeric_min`, `numeric_max`. TEXT has `text_max_length` (default 25 chars, alphanumeric + spaces only).

---

**7. Shared task model — single-completion vs multiple-completion**
✅ **Fully Implemented**
`CompletionType` enum: `SINGLE`, `MULTIPLE`. SINGLE enforced at two levels: (a) `TaskService.submitResponse()` pre-check, (b) unique partial index `idx_task_responses_single_active` on `(task_id, store_id, response_date) WHERE active=true AND completion_type='SINGLE'`. Race condition caught as `DataIntegrityViolationException` → `TaskAlreadyCompletedException` (409). MULTIPLE allows unlimited responses per store-date.

---

**8. Employee daily checklist — grouped by category, correct response type, sees already-completed tasks**
✅ **Fully Implemented**
`MeController.getTodayChecklist()` returns categories + tasks + responses for the selected store. `EmployeeDashboard` groups by category, renders correct input per `ResponseType`. Already-completed SINGLE tasks show "Completed by [name]" and disable the input. MULTIPLE tasks show "X/Y Completed By" with hover tooltip listing all responders.

---

**9. Daily completion status — visible at category and overall level**
✅ **Fully Implemented**
`EmployeeDashboard` computes and displays completion percentage per category and total. Visual progress bar and fraction shown. Updated in real time on each submission.

---

**10. Owner/Admin dashboard — today's completion across stores, REAL data**
✅ **Fully Implemented — Real Data Confirmed**
`DashboardShell` calls real API endpoints. `ChecklistHistoryController.getSummary()` queries `task_responses` directly. No hardcoded or mock data found in dashboard components. Stat cards on `SuperAdminDashboard` (Total Owners, Active Owners, Total Stores) are computed from the live owner list API response.

---

**11. Daily history — Admin views previous day's completion by store/date, what was answered and by whom**
✅ **Fully Implemented**
`ChecklistHistoryController.getDetail()` — returns all tasks for a store-date, each with response value, employee full name, and submission timestamp. `History.tsx` with store + date-range filter, opens a detail modal per store-date row. Employee identity (full name + `EMP-{id}`) is visible in the detail view.

---

**12. Admin corrections with audit trail — Admin edits a response, system logs original value, corrected value, who corrected, when**
❌ **Not Implemented**
No `admin_corrections` or equivalent table exists in any Flyway migration (V1–V22 checked). `task_responses` stores only the current value — no `original_value`, `corrected_by`, `corrected_at` columns. No `AdminCorrectionController` or correction endpoint in any controller. No correction UI in the Admin frontend. Only "undo" (soft-delete by the original submitter) is available. **This is a named PRD requirement — missing entirely.**

---

**13. Basic reporting — exportable/viewable daily operations summary and task-level detail**
⚠️ **Partially Implemented**
History page provides a viewable summary and detail view. `html2canvas` and `jspdf` are present in `package.json` as dependencies — suggesting export was planned — but neither is imported or called anywhere in the codebase. No CSV, PDF, or print export exists. Viewing is possible; exporting is not.

---

### Non-Functional Requirements

**14. Responsive web app usable on mobile and desktop**
✅ **Fully Implemented**
CSS uses `100dvh`, `env(safe-area-inset-*)`, `@custom-media` breakpoints. Login redesigned mobile-first. PWA support added (manifest, service worker, installable). Tested visually at mobile widths.

---

**15. HTTPS in production**
⚠️ **Partially Implemented (expected at this stage)**
No HTTPS configured in `application.yml` (server.port only). Relies on Railway/Vercel's built-in TLS termination. Both platforms provide HTTPS automatically on their domains — this is the correct and expected approach for this stack. No concern unless a custom domain is used without configuring TLS.

---

**16. Role-based access control enforced on both frontend AND backend**
✅ **Fully Implemented**
Backend: `@PreAuthorize("hasRole('OWNER_ADMIN')")` on `TaskController`, `CategoryController`, `EmployeeController`, `StoreController`. `@PreAuthorize("hasRole('SUPER_ADMIN')")` on `SuperAdminController`. `JwtAuthenticationFilter` validates token on every request. Service-layer scoping checks (`requireAssignedStore`, FK comparisons) prevent cross-owner data access even within the same role.  
Frontend: Route gating in `App.tsx` by role — Employees never see Admin components and vice versa. Note: frontend gating is UI-only and not a security control; the backend `@PreAuthorize` is the actual enforcement.

---

**17. Low operational cost architecture — no Redis/message bus**
✅ **Fully Implemented**
Stack: PostgreSQL (Neon free/starter tier), Spring Boot (Railway), React (Vercel). No Redis, no Kafka/RabbitMQ, no external caching service. `active_sessions` table in PostgreSQL replaces a session store. `@Scheduled` for cron jobs. Architecture is deliberately minimal.

---

**18. Simple, reliable backup strategy for the database**
⚠️ **Partially Implemented (implicit only)**
No explicit backup configuration found in the codebase or any config file. Database is hosted on Neon, which provides automatic daily backups and point-in-time restore (PITR) on paid plans, plus branch-based snapshots. **However, this is entirely implicit — no documentation of the backup approach, no backup verification process, no restore test record.** This should be explicitly documented and confirmed with the client.

---

**19. Works on mainstream browsers**
✅ **Fully Implemented**
Vite build target, CSS variables, `dvh` units, and `env()` functions have broad support in modern Chrome, Safari, Firefox, Edge. `-webkit-backdrop-filter` vendor prefix present in login CSS for Safari compatibility. No IE-specific code or legacy polyfills needed.

---

**20. Architecture scales to more stores without redesign**
✅ **Fully Implemented**
`employee_stores` many-to-many; `task_stores` many-to-many; `applies_to_all_stores` flag; `ChecklistHistoryService.MAX_STORE_SELECTION = 50`. Store count is not hardcoded anywhere in business logic. Adding a new store requires only a database row, not a code change.

---

## PART 1 — AUTH & ACCOUNT FLOWS

**1. Complete login flow**
Login → `AuthController.login()` → JWT issued (default 24h expiry, configurable via `JWT_EXPIRATION_MS`) → `App.tsx` routes by role → `DashboardShell` (OWNER_ADMIN), `SuperAdminDashboard` (SUPER_ADMIN), or `StorePicker`/`EmployeeShell` (EMPLOYEE).  
Session persistence: token in localStorage (remember me) or sessionStorage (no remember me). On page refresh, `App.tsx` calls `getMe()` using the stored token to re-hydrate state.  
Inactivity timeout: `getSessionConfig()` returns a server-configurable timeout (default 30 min). Frontend timer resets on any user interaction; on expiry, `endSession()` clears token and redirects to login with notice banner.  
Token expiry mid-session: global `fetch` patcher intercepts 401 responses; calls `onUnauthorizedResponse()` → `endSession()` → login page with "Your session has expired" notice. No silent refresh — user must re-authenticate.

**2. Forgot Password**
⚠️ **Frontend complete, backend endpoint does not exist.**  
`ForgotPassword.tsx` submits to `POST /auth/forgot-password`. This endpoint is **not present in `AuthController`**. The call returns a 404. The `auth.ts` wrapper catches non-OK and throws `Error('Unable to send reset instructions')` — user sees a generic error. Resend API integration exists in `MailService` (used for owner onboarding emails) but is never wired to a password reset flow. No reset token generation, storage, or link-in-email mechanism exists anywhere in the backend. The feature is entirely unbuilt on the server side.

**3. Profile page**  
Both Admin and Employee profiles served by `MeController.getMe()`. Editable fields: full name, email, phone. Changes persist via `MeController.updateMe()` (PUT). Password reset via separate modal → `AuthController.changePassword()` (validates current password). After a profile save, the calling component re-fetches `getMe()` and updates local state, but **no toast is shown** — save is silent. Whether an employee's updated name propagates to the Admin's employee list depends on the Admin re-fetching their employee list; there is no real-time push or cache invalidation.

**4. Logout**  
Frontend: calls `logout()` → `POST /auth/logout` → backend `SessionService.invalidate()` removes the `active_sessions` row. Frontend always calls `endSession()` after, regardless of whether the API call succeeds. Token cleared from storage. Cross-tab sync: `storage` event listener in `App.tsx` detects token removal and ends the session in all open tabs. Stale token after logout: backend session is invalidated, but `JwtAuthenticationFilter` checks both token signature AND session existence (`SessionService.isValid()`), so a replayed stale token after logout will be rejected.

**5. Deactivation mid-session**  
⚠️ **Partially handled — gap exists.**  
If `user.active = false` is set by an admin, the change only takes effect on the user's NEXT login attempt (login check: `UserDetailsService` calls `User::isActive`). **A currently-authenticated employee with a valid JWT can continue making API requests until their token expires (up to 24 hours)** — the `JwtAuthenticationFilter` checks token signature and session validity, but does NOT re-query `user.active` on every request. Similarly, store deactivation (`StoreOwner.active = false`) does not eject active employee sessions for that store.

**6. Forced password reset (mustResetPassword)**  
✅ **Fully wired.**  
`users.must_reset_password` column exists. Set to `true` on owner account creation via `addOwner`. `AuthController.login()` returns `mustResetPassword` in `LoginResponse`. `App.tsx` gates the entire UI: if `needsPasswordReset = true`, only `ResetPasswordRequired` is rendered (blocking, no navigation escape except logout). On submit, `POST /auth/reset-password` → `AuthService.resetPassword()` sets `must_reset_password = false`. Frontend clears the gate. Full loop confirmed.

---

## PART 2 — COMMON PRODUCTION-APP ESSENTIALS

**7. Form validation quality**  
⚠️ **Inconsistent.** Profile form: inline per-field errors after submit attempt. Task creation: validation exists for required fields. Login: no client-side validation — submits to server and shows "Invalid email or password" (no field-level specificity). Category and employee creation forms: partially validated. Text response type has 25-char limit enforced both client (character count) and server (regex pattern match on `[a-zA-Z0-9 ]{1,25}`). No validation on login email format client-side (type="email" relies on browser, not custom message).

**8. Loading states**  
⚠️ **Present but inconsistent.** `EmployeeDashboard`: "Loading today's checklist…" text spinner. `History.tsx`: spinner on table. `App.tsx`: text "Loading…" during session restore. `StorePicker`: no explicit loading indicator while stores fetch. `SuperAdminDashboard`: spinner on table. Some smaller components (category list, task list) — loading states not confirmed in agent's findings.

**9. Empty states**  
⚠️ **Partial.** `EmployeeDashboard`: empty illustration + "No checklist tasks yet" (confirmed). `SuperAdminDashboard`: no explicit empty-owners state — empty table shown with no call-to-action. `NoStoreAssigned`: dedicated page shown when employee has no store assignments. New store with no categories/tasks: shows empty checklist — no "get started" guidance for the Admin on how to create their first category.

**10. Error states**  
⚠️ **Partial.** `EmployeeDashboard`: error banner with Retry. `History.tsx`: error banner with Retry. `App.tsx`: error banner with Retry on session restore failure. Per-task submission errors shown inline. Some pages (e.g., category/task list pages) — error states not confirmed in agent's findings; may fail silently.

**11. Confirmation dialogs on destructive actions**  
⚠️ **Inconsistent.** `SuperAdminDashboard`: ConfirmDialog before owner/store deactivation — confirmed. Employee delete: `EmployeeController` has `DELETE /{id}` endpoint; frontend destructive action confirmation not confirmed in agent's findings for this specific action. Task delete: `TaskController.deleteTask()` throws 409 if history exists — server protects against deleting tasks with history, but no client-side confirmation dialog confirmed. Category delete — confirmation not confirmed. One confirmed missing: `EmployeeDashboard` task "Undo" response has no confirmation dialog — immediately reverts the response.

**12. Toast/notification system**  
❌ **Not implemented.** No toast library in `package.json`. No toast component in codebase. Successes are silent (UI state update only). Errors are shown inline or in banners. No consistent feedback pattern across screens. A user saving their profile receives no acknowledgment beyond the form closing.

**13. 404 / unauthorized pages**  
⚠️ **Partial.** `App.tsx` gates by auth state and role — an unauthenticated user hitting any route sees the Login page. A logged-in Employee cannot navigate to Admin routes because the router is a hand-rolled state machine (not URL-based), so deep-linking to a specific "admin" URL doesn't exist — the role gates in `App.tsx` render the appropriate shell regardless of URL. Backend API-level: unauthorized role access returns Spring Security's default 403. No custom 403/404 page exists for direct API misuse.

**14. Session timeout UX**  
✅ **Implemented.** Inactivity timer in `App.tsx`; on expiry, `endSession()` → Login page with `notice` prop ("Your session has expired, please sign in again"). Global 401 catcher also routes here for mid-session token expiry.

**15. Search/filter/pagination on large lists**  
⚠️ **Partial — will not scale.** History page: manual date-range + store filter, fetches all matching rows. SuperAdminDashboard: client-side text search on owners list, no pagination. Employee list, task list, category list: no search, no filter, no pagination confirmed. All list endpoints return complete result sets. At 50+ employees or 100+ tasks, these views will become unwieldy and slow.

**16. Accessibility basics**  
⚠️ **Partial.** `htmlFor` on form labels: present in `FormField` component. Password visibility toggle: `aria-label` confirmed. "X/Y Completed By" tooltip: `aria-describedby` and `aria-expanded` confirmed. Keyboard focus: `outline: 2px solid var(--color-focus-ring)` in base CSS (`:focus`). `aria-live` regions for dynamic content: not found. Icon-only buttons without text labels lack `aria-label` in most places. Color contrast: not formally verified against WCAG 2.1 AA — dark theme uses `#9a9aa0` for muted text on near-black backgrounds, which may fail 4.5:1 contrast at small sizes.

---

## PART 3 — INDUSTRY COMPARISON

Compared against Jolt, Zenput, Crunchtime task-checklist feature sets at the Phase 1 (daily operations) level — excluding anything explicitly out-of-scope per PRD.

**Features commonly expected in this category that are currently absent:**

1. **Admin task correction / override workflow** — In every comparable platform, managers can correct a wrong employee response and the system records who changed what. NForce has no mechanism for this at all (also a named PRD requirement — #12).

2. **Comments/notes on task responses** — Employees commonly need to add context ("machine was down," "ice cream out of stock") alongside a Yes/No. No free-text note field attached to a response exists today.

3. **Missed/overdue task visibility** — At end of day, a clear "these tasks were not completed" summary with timestamps. History shows what was done but doesn't surface incomplete tasks prominently.

4. **Task templates or duplication** — Creating recurring task sets from scratch is tedious. No "duplicate task" or "apply template" function exists.

5. **Bulk task operations** — No way to bulk-activate, bulk-assign stores, or bulk-reorder tasks. At 20+ tasks per store this becomes friction-heavy.

6. **Manager acknowledgment/sign-off** — Some platforms require a manager to explicitly "close out" the day, confirming review. No such concept exists in NForce yet.

7. **Print/export daily log** — `html2canvas` and `jspdf` are in `package.json` but never implemented. Managers printing or emailing a daily summary is a very common operational need.

8. **Activity feed / real-time completion updates for admins** — Admin dashboard shows completion snapshot but doesn't update live. Polling exists on the employee checklist (15s), but Admin dashboard polling status is not confirmed.

---

## PART 4 — STRUCTURED FINDINGS

---

### ✅ Implemented & Working

**Auth**
- JWT login with role-based redirect (SUPER_ADMIN / OWNER_ADMIN / EMPLOYEE)
- Token stored correctly per "remember me" preference (localStorage vs sessionStorage)
- Session invalidated on backend at logout; cross-tab logout sync works
- Inactivity timeout with "session expired" notice at Login
- Global 401 interceptor redirects mid-session token expiry to Login
- Forced password reset (mustResetPassword) — fully wired end to end

**Employee Experience**
- Daily checklist grouped by category, correct input per response type (Yes/No, Done, Number, Text)
- Single-completion enforcement at both service and DB index level (race-safe)
- Multiple-completion tracking with responder list tooltip
- Progress percentage at category and overall level, updated on each submission
- Undo own response (soft-delete, not hard-delete)
- Multi-store assignment with StorePicker session selection
- Employee history view for own store-date

**Admin Experience**
- Category management (create/edit/reorder/activate/deactivate)
- Task management (create/edit/toggle/delete — with delete protection if history exists)
- Task scheduling (daily/weekdays/weekends/specific days + date range + time window)
- All four response types configurable per task
- Single vs multiple completion mode per task
- Employee management (create/edit/toggle active status/delete)
- History view: store-date detail with employee names and timestamps (real data)
- SuperAdmin owner lifecycle (create/assign store/activate/deactivate)

**Data Integrity**
- DB-level unique index prevents duplicate SINGLE-completion responses under race conditions
- FK constraints prevent deleting tasks that have response history (409 thrown)
- `task_responses` soft-deletes (undone_at, active flag) — data never destroyed
- Flyway migrations (V1–V22) — schema versioned and reproducible
- Multi-store architecture: `employee_stores`, `task_stores` many-to-many — scales without code changes

**UX Polish**
- Loading states: checklist, history, session restore, SuperAdmin dashboard
- Error states: checklist, history, session restore, stores fetch
- Confirmation dialogs: owner deactivation/reactivation in SuperAdmin
- Empty state: no-checklist illustration in EmployeeDashboard
- Responsive: mobile-first login, PWA-installable, safe-area padding, `100dvh`

---

### ⚠️ Implemented but Incomplete/Buggy

**Auth**
- **Forgot Password** — Frontend fully built (`ForgotPassword.tsx`, `requestPasswordReset()` in `auth.ts`), but the backend endpoint `POST /auth/forgot-password` does not exist in `AuthController`. Every reset attempt fails with 404. **Risk: Employees and admins with forgotten passwords have no self-service recovery path. Must contact someone to reset manually.**
- **Deactivation mid-session not enforced** — If Admin sets `employee.active = false` or Super Admin deactivates an owner, they can continue making authenticated API requests until their JWT expires (up to 24 hours). **Risk: A terminated or suspended employee could keep accessing and modifying store data for up to a full day.**

**Employee Experience**
- **No confirmation on task undo** — Tapping "Undo" immediately reverts a task response with no "Are you sure?" step. **Risk: Accidental undo on a completed task loses the response; employee must redo all inputs.**
- **Text response character set too restrictive** — Server validates TEXT responses against `[a-zA-Z0-9 ]{1,25}`. Apostrophes, hyphens, common punctuation rejected silently (or with a generic error). **Risk: Employee types a valid note ("Machine broken - call mgr") and hits an opaque rejection.**

**Admin Experience**
- **One-time task schedule type missing** — `ScheduleType` enum has no `ONE_TIME` value. Clients who want a task to run only on a specific date with no recurrence must manually deactivate the task the next day. **Risk: One-time audit tasks remain active indefinitely unless Admin remembers to deactivate them.**
- **No export/print of daily log** — `html2canvas` and `jspdf` in `package.json` but never wired. History is viewable only on screen. **Risk: Client cannot produce the paper or email summary that store managers commonly need for shift hand-off or inspection prep.**
- **No empty-state guidance for new Admin** — A brand-new owner account with no categories or tasks sees a blank checklist and an empty admin panel with no call-to-action or setup wizard. **Risk: New store owners don't know where to start; onboarding friction.**
- **Pagination absent on all lists** — Employee list, task list, category list, history table all return full result sets with no pagination. **Risk: Performance degrades visibly at 50+ tasks or 30+ employees; browser may stall on slow connections.**

**UX Polish**
- **No toast/success feedback system** — Profile saves, task creates, employee creates, category saves all succeed silently. **Risk: Users repeatedly submit forms thinking nothing happened, creating duplicates or confusion.**
- **Form validation inconsistent** — Login has no client-side email validation (relies on browser `type=email`). Some creation forms lack field-level error messages. **Risk: Confusing UX when the server rejects input and the frontend shows a generic "something went wrong."**
- **Undo on task response** has no confirmation dialog (noted above under Employee Experience).
- **Admin dashboard polling status unclear** — Employee checklist polls every 15s. Whether the Admin completion dashboard polls for live updates is unconfirmed; may show stale data during active employee sessions.

---

### ❌ Missing Entirely

**Data Integrity**
- **Admin correction with audit trail (PRD requirement #12)** — No endpoint, no table, no UI. An Admin cannot edit any submitted employee response. No record of who changed what or when exists in the database. **Risk: If an employee submits a wrong answer (Yes instead of No for a critical safety check), a manager has no way to correct it in the system. The official record stays wrong. This is a named contractual requirement.**

**Auth**
- **Forgot Password backend** — `POST /auth/forgot-password` endpoint, reset token generation, token storage, reset link email via Resend, token validation on use. All absent. (Frontend exists; backend entirely missing.) **Risk: Any user who forgets their password must contact the Super Admin for a manual reset — not viable at scale.**

**UX Polish**
- **Toast/notification system** — No library, no component, no consistent success feedback anywhere. **Risk: Users don't trust the app is saving their actions. Silent success is worse than no feedback on a mobile app where taps are imprecise.**
- **Rate limiting on auth endpoints** — No protection on `POST /auth/login`. Brute-force attacks possible. **Risk: An attacker can attempt unlimited password guesses against any account without throttling or lockout.**

**Admin Experience**
- **Comments/notes on task responses** — No way for an employee to attach context to a Yes/No or Done response. **Risk: Manager sees "No" on a safety task but has no way to know WHY — critical for compliance scenarios.**
- **Manager sign-off / day close** — No workflow for a manager to explicitly acknowledge and close out the day's checklist. **Risk: No formal accountability record that a manager reviewed the day's operations.**

---

## PRIORITY SHORTLIST — Fix These Before Real Users

Ranked by risk/impact. PRD-named requirements (especially #12) are automatic top priority.

**P0 — Ship-blocker (do not go to production without these)**

1. **Admin correction with audit trail** *(PRD requirement #12 — contractual)*  
   Add `admin_corrections` table, `PATCH /checklist-history/{storeId}/{taskId}/responses/{responseId}` endpoint (OWNER_ADMIN only), and Admin UI on the history detail modal. Store: original value, corrected value, corrected_by user ID, corrected_at timestamp. This is explicitly named in the PRD. Missing it means the product doesn't match what was sold.

2. **Forgot Password — backend endpoint**  
   `POST /auth/forgot-password`, reset token (UUID, 1hr expiry), token stored in DB, Resend email with reset link, `POST /auth/forgot-password/confirm` to consume token and set new password. Frontend already built. This is the only self-service recovery path — without it, every forgotten password requires manual admin intervention.

3. **Toast/success notification system**  
   Add `react-hot-toast` (or equivalent, 1 dependency). Wire to all create/update/delete API calls. Without this, users don't trust saves happened — they resubmit, creating duplicates. Especially critical on mobile where network latency makes silent success feel like a freeze.

**P1 — Fix before first client store goes live**

4. **Deactivation mid-session enforcement**  
   On every authenticated request, `JwtAuthenticationFilter` should check `user.active` (one DB read, cacheable short-term). If false, return 401 immediately. A terminated employee should not continue accessing store data for 24 hours post-termination.

5. **Confirmation dialog on task response undo**  
   One accidental tap on Undo destroys a completed checklist response with no recovery (unless Admin has correction capability — see #1). A two-tap confirm is a one-hour fix with real safety value.

6. **Destructive action confirmations — employee delete, category delete, task delete**  
   Audit all Admin destructive buttons and add confirmation dialogs where missing. Employee delete permanently removes a staff member and their future association (history is FK-protected, so historical data survives, but the account is gone).

**P2 — Fix before scaling beyond 2 stores**

7. **Forgot Password — rate limiting**  
   At minimum, rate-limit `POST /auth/login` (e.g. 5 attempts per 15 minutes per IP). Simple Spring implementation. Without this, login is brute-forceable.

8. **Text response character set expansion**  
   Change TEXT response validation from `[a-zA-Z0-9 ]{1,25}` to allow common punctuation (apostrophes, hyphens, commas, periods). Employees will type natural language — rejecting valid notes silently breaks trust.

9. **One-time task schedule type**  
   Add `ONE_TIME` to `ScheduleType` enum. Automatically deactivate (or skip) after the task's `end_date` passes. Required for compliance checklists and audit tasks.

10. **Export daily log (PDF/print)**  
    Wire the already-installed `html2canvas` + `jspdf` to generate a one-page daily operations summary from the History detail view. This is the #1 operational output managers expect from a checklist app — summary for shift hand-off, health inspections, or owner review.

---

*This report is a point-in-time analysis of commit `76af178` on branch `vigneshdev`, 2026-09-03. All findings reflect actual code — no assumptions made about intended behavior.*
