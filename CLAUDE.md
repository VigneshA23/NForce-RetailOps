# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Retail operations platform with three roles: an employee checklist + stock-count UI, an owner/admin dashboard, and a super-admin layer managing owners, stores, the task catalogue and the inventory catalogue across the platform.

Scope is larger than "checklists and a dashboard". Built out and in use: task scheduling and responses, missed-task moves, admin corrections and flags, raised issues with escalation, notifications and scheduled alerts, suppliers, an inventory catalogue, daily stock checks (plus Owner/Admin's date-bounded stock-check history), order lists, an activity log, server-side sessions, and login rate limiting. Roughly 20 controllers, 33 services, 33 entities, 100 DTOs, 67 migration files, ~74 frontend pages and ~163 components.

## Commands

### Frontend (`frontend/`)

`npm run dev` · `npm run build` (`tsc -b && vite build`) · `npm test` (`vitest run`).

`npm run lint` (`eslint .`) will fail — ESLint is neither installed nor configured. Fix that before relying on the script.

Tests use Vitest + Testing Library + jsdom (`frontend/src/test/setup.ts`, `vite.config.ts`'s `test` block). Test files sit next to the code they cover (e.g. `Header.test.tsx`), not in a separate `__tests__` tree. 37 test files currently.

### Backend (`backend/`)

Requires Java 17+ and a running PostgreSQL instance (Neon or local). Connection vars are `DATABASE_URL` / `DATABASE_USERNAME` / `DATABASE_PASSWORD`, loaded from `backend/.env` via `spring-dotenv`.

**No `.env.example` exists in either app** — create `backend/.env` and `frontend/.env` by hand. See the README for the variable list.

`mvn spring-boot:run` · `mvn test` · single test: `mvn test -Dtest=ClassName#methodName`.

Tests run against H2 in PostgreSQL compatibility mode with Flyway disabled (`backend/src/test/resources/application-test.yml`). 43 test classes, ~404 test methods.

## Architecture

### Frontend

React 18 + Vite + TypeScript SPA with **no routing library and no URL paths**. `App.tsx` is a hand-rolled state machine picking the root component by auth state and role: unauthenticated renders `Login` (which contains its own inline forgot-password view) or `SetNewPassword` when a `?token=` param is present; `mustResetPassword` renders `ResetPasswordRequired`; `SUPER_ADMIN` renders `SuperAdminDashboard`; `OWNER_ADMIN` renders `DashboardShell`; `EMPLOYEE` renders `NoStoreAssigned`, `StorePicker`, or `EmployeeShell` depending on store assignment and selection.

Below the root, each role's shell owns an `activeTab` + `overlay` state pair persisted via `utils/navigationStorage.ts`. Notification `linkPath` strings are translated to tab keys through the maps in `utils/notificationRoutes.ts`, not routed. `EmployeeShell` and `DashboardShell` keep visited tabs mounted and hidden so switching never refetches; `SuperAdminDashboard` unmounts inactive tabs, so its pages refetch on every switch.

No server-state library. Data fetching is plain `fetch` wrappers in `src/api/` (one file per resource) with `useState`/`useEffect` and **60-second polling** where live data is needed — every poll in the app is 60s.

**Two API styles coexist; use the first for new code:**
- `api/client.ts` exports `apiRequest<T>()`, which attaches `authHeaders()`, JSON-encodes the body, and throws `ApiError` carrying a `.status`. 22 of the 30 API modules use it.
- A legacy pattern — raw `fetchWithTimeout` plus a privately copy-pasted `parseErrorMessage` — survives in `auth.ts`, `categories.ts`, `checklistHistory.ts`, `employees.ts`, `history.ts`, `owners.ts`, `ownerStores.ts`, `ownerTasks.ts`. These throw plain `Error`, so `instanceof ApiError` / `.status` checks do not work against them. Don't add more of these.

`authHeaders()` lives in `utils/authStorage.ts`, which is also the only place the JWT is read or written. The token goes to `localStorage` when "remember me" is ticked and `sessionStorage` otherwise, never both — and `wasRememberedLogin()` is derived from *which* storage holds it rather than stored separately. The user object is never persisted; role and name always come back from `GET /me`.

Layout: `api/`, `components/` (one `.tsx` + matching `.css` per component, plain class names, not CSS modules), `pages/`, `layouts/` (`AppShell` plus `EmployeeShell` and `DashboardShell`; the super-admin shell is `pages/SuperAdminDashboard.tsx`, not a layout), `hooks/`, `utils/`, `types/`, `styles/` (shared tokens/base styles).

Charts use Recharts; icons `lucide-react`; drag-reorder `@dnd-kit`; `motion` and `ogl` for auth-screen and button flourishes. Report export is **Excel via ExcelJS** (`utils/operationsReportExport.ts`) and **PDF via jsPDF + jspdf-autotable** (`utils/operationsReportPdfExport.ts`), both dynamically imported. Order lists export as **plain text grouped by supplier** for WhatsApp/SMS (`utils/orderListExport.ts`), not PDF. `html2canvas` is declared in `package.json` but imported nowhere.

### Backend

Spring Boot 3.3.4 (Java 17) monolith, conventional layered architecture — `controller/ → service/ → repository/`, with `dto/` and `entity/` kept separate (do not return entities directly from controllers). `config/` and `security/` hold Spring configuration and the JWT auth setup. `exception/` holds domain-specific exceptions (e.g. `EmployeeNotFoundException`, `CategoryNameExistsException`) each mapped to an HTTP status in the single `GlobalExceptionHandler` (`@RestControllerAdvice`) — add new domain errors the same way rather than handling them ad hoc in controllers. All error bodies are `{ "message": ... }`, except validation failures which return a field→message map.

**Auth is JWT + bcrypt but not purely stateless.** Login issues a JWT *and* writes an `active_sessions` row keyed by the token's `jti`. Every request then: validates the signature → `SessionService.validateAndTouch(jti)` (server-side revocation and sliding expiry, throttled to one write per 20s) → re-loads the account from the database → rejects if disabled → blocks everything but the reset endpoints when `mustResetPassword` is set. That's two DB round-trips per request, bought deliberately so deactivation and logout take effect immediately rather than at token expiry.

**Three roles, but only two are `Role` rows.** `EMPLOYEE` and `OWNER_ADMIN` are rows in `roles` linked to `users`. **`SUPER_ADMIN` is a separate `super_admins` table with no FK to `users`** — `AppUserDetailsService` looks up `users` first then falls back to `super_admins`, and `SuperAdminUserDetails` synthesises the authority. When touching auth, remember a principal may be either `AppUserDetails` or `SuperAdminUserDetails`; several controllers take `@AuthenticationPrincipal Object` and branch on the type.

Open paths: `/api/auth/login`, `/api/auth/session-config`, `/api/auth/forgot-password`, `/api/auth/forgot-password/confirm`, `/actuator/health`, `/error`, `OPTIONS /**`, and `/internal/jobs/**` (protected only by an `X-Internal-Job-Secret` header). Everything else requires a bearer token; role checks are `@PreAuthorize` at the method level.

`MeController` has **no class-level role gate**. Store isolation is enforced imperatively by `UserProfileService.requireAssignedStore`, which masks unauthorised stores as 404 rather than 403. Preserve that when adding `/api/me` endpoints.

**One active store per owner** (partial unique index, `V27__enforce_single_store_per_owner`). This supersedes `V7__allow_multiple_stores_per_owner`. Deactivating or deleting an owner releases the store link but records `last_owner_id`, so `StoreOwner.resolveTaskOwnerId()` keeps a vacant store's tasks visible to its employees.

### The daily checklist has no reset job

The checklist is **derived at read time**, not materialised and reset. `TaskService.getTodayChecklistForEmployee` takes `LocalDate.now()`, finds active tasks whose store scope and date range cover today, filters through `TaskScheduleMatcher`, and looks up responses stored against today's `response_date`. Tomorrow nothing matches and the checklist is fresh. There is no rollover write.

Consequences to respect when changing this area:
- Carry-forward is explicit — `TaskMakeupLinkService` moves a missed instance to a chosen date (7-day lookback, 7 days ahead). Never add automatic carry-forward.
- History is *reconstructed* using the same `TaskScheduleMatcher`, deliberately without the `active` filters, so deactivated tasks still appear on past days. Keep the matcher shared so live and historical views can't drift.
- `SINGLE` completion = first responder wins, backed by a partial unique index (V19). `MULTIPLE` requires ≥2 distinct responders.
- Responses are never hard-deleted — `active=false` plus `undoneAt` / `supersededResponseId`. Corrections write in place *and* append an immutable `admin_corrections` row.
- `admin_corrections` is hard-wired to task responses only — a `NOT NULL` FK to `task_response_id`, no polymorphic entity reference — so it cannot audit anything else. Stock-check corrections (`StockCheckService.correctCheck`) use their own append-only `stock_check_corrections` table (`StockCheckCorrection`) instead; follow that precedent for any future per-domain correction trail rather than widening `admin_corrections`.
- Every date boundary uses the server's default JVM timezone. There is no per-store timezone column.

### Database

PostgreSQL (hosted on Neon). Schema is managed exclusively through Flyway migrations in `backend/src/main/resources/db/migration` — `spring.jpa.hibernate.ddl-auto` is `validate`, so schema changes must go through a new, sequentially-numbered migration (`V{n}__description.sql`), never Hibernate auto-DDL.

V25, V51 and V57 do not exist on this branch. `validate-on-migrate: false` and `ignore-migration-patterns: ["*:missing", "*:future"]` are set because the team shares one dev database across feature branches. Pick the next unused number and don't try to backfill the gaps.

Dead columns that exist in the DB but not in the entities: `stores.open_time` / `close_time` (V32). `store_employees.shift` was added, dropped, restored and dropped again (V6 → V61 → V62 → V63).

### No caching layer, no message bus

Service methods call each other synchronously within the same request. Don't introduce Redis/events/queues without an explicit reason; the app is intentionally kept simple at its current scale.

### Scheduling

`@Scheduled` is enabled by `config/SchedulingConfig` — gated on `app.scheduling.enabled` (`APP_SCHEDULING_ENABLED`, default true), **not** by an annotation on `RetailOpsApplication`.

Seven jobs: three at 3am (deactivate tasks past end date, expire stale task moves, purge resolved issues older than 7 days), three super-admin alerts (zero-activity 8pm, overdue-issues 9am, owner-vacancy hourly), and an hourly login-attempt purge.

Each has a twin endpoint under `/internal/jobs/` in `InternalJobController`, so an external scheduler can drive the same work when in-process scheduling is disabled. **Add both sides when adding a job**, or it will silently not run on Lambda.

## Testing

- Backend: JUnit 5 + Mockito + H2 in-memory DB, 49 test classes. `AuthControllerTest` is the reference for controller tests (`spring-security-test` is on the classpath); `TaskServiceTest` and `ChecklistHistoryServiceTest` are the reference for service tests. `TodayChecklistContractTest` locks the checklist response shape — expect it to fail if you change that DTO.
- Frontend: Vitest + Testing Library, 37 test files. `App.test.tsx` covers the root state machine; page tests like `EmployeeDashboard.test.tsx` and `StoreDetail.test.tsx` are the pattern for new ones.

## Deployment

**No CI/CD is committed to this repo** — no GitHub Actions, no Vercel or Railway config, no Dockerfile. The intent is Vercel (frontend) + Railway (backend).

An AWS Lambda path *is* committed: `LambdaHandler.java`, the `lambda` Maven profile (shaded uber-JAR), SES as the mail transport when `AWS_LAMBDA_FUNCTION_NAME` is set, and the `/internal/jobs/**` endpoints replacing in-process scheduling. See `docs/lambda-migration-plan.md`. Deployment there is manual.

`MailService` picks its provider at construction: SES on Lambda, Resend otherwise.

## Repo docs

`docs/` holds design and audit documents. Several are stale — in particular `docs/phase1-full-audit-v3.md` (dated 2026-09-04) lists raised issues, admin corrections and login rate limiting as unimplemented; all three have since shipped. Treat `docs/` as historical intent, not current state.
