# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Two-store retail operations app: an employee checklist UI and an owner/admin dashboard, plus a super-admin layer for managing owners and stores across the platform. `backend/` and `frontend/` both have real domain code (auth, stores, employees, categories) — this is not a scaffold.

## Commands

### Frontend (`frontend/`)

```
npm install          # install deps
npm run dev          # start Vite dev server (port 5173)
npm run build        # tsc -b && vite build
npm run preview      # preview production build
npm run test         # vitest run
npm run lint         # eslint . — no ESLint config exists in the repo yet, this will fail until one is added
```

Tests use Vitest + Testing Library + jsdom (`frontend/src/test/setup.ts`, `vite.config.ts`'s `test` block). Test files sit next to the code they cover (e.g. `Header.test.tsx`), not in a separate `__tests__` tree.

### Backend (`backend/`)

Requires Java 17+ and a running PostgreSQL instance (Neon or local; connection vars are `DATABASE_URL` / `DATABASE_USERNAME` / `DATABASE_PASSWORD`, loaded from `backend/.env` via `spring-dotenv` — there is no committed `.env.example` for the backend, unlike the frontend).

```
mvn spring-boot:run                          # run the app
mvn test                                     # run all tests
mvn test -Dtest=ClassName#methodName         # run a single test
mvn package                                  # build the jar
```

Tests run against H2 in PostgreSQL compatibility mode with Flyway disabled (`backend/src/test/resources/application-test.yml`).

## Architecture

### Frontend

React + Vite + TypeScript SPA with **no routing library** — `App.tsx` is a hand-rolled state machine that picks the root component by auth state and role: unauthenticated renders `Login`/`ForgotPassword`; `user.role === 'SUPER_ADMIN'` renders `SuperAdminDashboard`; `'OWNER_ADMIN'` renders `DashboardShell`; `EMPLOYEE` without a selected store renders `StorePicker`, then `EmployeeShell` once a store is chosen. There's no server-state library either — data fetching is plain `fetch`-based wrapper functions in `src/api/` (one file per resource: `auth.ts`, `employees.ts`, `stores.ts`, `categories.ts`, `owners.ts`, `ownerStores.ts`, `history.ts`) paired with `useState`/`useEffect` and polling (15s/60s intervals) where live data is needed, not React Query or similar.

Each `api/` function builds on `authHeaders()` from `utils/authStorage.ts` (JWT stored client-side, attached as a bearer header) and a shared `parseErrorMessage` pattern that reads `{ message }` off a non-OK JSON response and falls back to a generic string — follow that pattern for new API functions rather than introducing a new error shape.

Layout: `api/` (backend calls), `components/` (mostly one `.tsx` + matching `.css` per component, not CSS modules — plain class-name based stylesheets), `pages/`, `layouts/` (the shell components keyed to each role: `EmployeeShell`, `DashboardShell`, plus `AppShell`), `hooks/`, `utils/`, `types/`, `styles/` (shared tokens/base styles, e.g. `tokens.css`, `buttons.css`, `table.css`). Charts use Recharts; icons use `lucide-react`; PDF export (order lists, cash summaries) is done client-side with `html2canvas` + `jsPDF`; `motion` (Framer Motion) and `ogl` are available for animated/visual flourishes on auth screens.

### Backend

Spring Boot 3 (Java 17 source/target) monolith, conventional layered architecture — `controller/ → service/ → repository/`, with `dto/` and `entity/` kept separate (do not return entities directly from controllers). `config/` and `security/` hold Spring configuration and the JWT auth setup. `exception/` holds domain-specific exceptions (e.g. `EmployeeNotFoundException`, `CategoryNameExistsException`) each mapped to an HTTP status in the single `GlobalExceptionHandler` (`@RestControllerAdvice`) — add new domain errors the same way rather than handling them ad hoc in controllers.

Auth is stateless JWT (`jjwt`) + bcrypt via Spring Security (`SecurityConfig`), with `@PreAuthorize`/method security for three roles: **Employee** (`StoreEmployee`), **Owner/Admin** (`StoreOwner`), and **Super Admin** (`SuperAdmin`) — a `User` + `Role` pair underlies all three, with per-role detail entities linked to it. Only `/api/auth/**` and `/actuator/health` are open; everything else requires a valid bearer token (`JwtAuthenticationFilter`). An owner can be linked to multiple stores (see the `V7__allow_multiple_stores_per_owner` migration).

### Database

PostgreSQL (hosted on Neon). Schema is managed exclusively through Flyway migrations in `backend/src/main/resources/db/migration` — `spring.jpa.hibernate.ddl-auto` is set to `validate`, so schema changes must go through a new, sequentially-numbered Flyway migration file (`V{n}__description.sql`), never through Hibernate auto-DDL.

### No caching layer, no message bus

Service methods call each other synchronously within the same request. Don't introduce Redis/events/queues without an explicit reason; the app is intentionally kept simple at 2-store scale.

### Scheduling

Use Spring's built-in `@Scheduled` (already enabled via `@EnableScheduling` on `RetailOpsApplication`) for jobs like daily checklist reset/rollover and order-list generation — no external scheduler.

## Testing

- Backend: JUnit 5 + Mockito + H2 in-memory DB. Only one test class exists so far (`AuthControllerTest`) — it's the reference pattern for new controller tests (Spring Security test support is on the classpath via `spring-security-test`).
- Frontend: Vitest + Testing Library. Coverage is currently thin (`App.test.tsx`, `Header.test.tsx`) — follow their setup/rendering pattern for new component tests.

## Deployment

Frontend deploys to Vercel, backend to Railway, both auto-deploying on push (no manual deploy steps, no Docker/Kubernetes). CI is GitHub Actions (frontend) + Railway's built-in pipeline (backend) — neither exists yet in this repo.
