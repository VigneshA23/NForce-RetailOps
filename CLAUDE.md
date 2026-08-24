# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Two-store retail operations app: an employee checklist UI and an owner/admin dashboard. The repo is currently a bare scaffold — `frontend/` and `backend/` contain layered folder structure but no domain code, entities, or tests yet.

## Commands

### Frontend (`frontend/`)

```
npm install          # install deps
npm run dev           # start Vite dev server (port 5173)
npm run build          # tsc -b && vite build
npm run preview         # preview production build
npm run lint           # eslint — not yet configured, will fail until an ESLint config is added
```

### Backend (`backend/`)

Requires Java 17+ and a running PostgreSQL instance (connection vars in `backend/.env.example`).

```
mvn spring-boot:run     # run the app
mvn test              # run all tests
mvn test -Dtest=ClassName#methodName   # run a single test
mvn package            # build the jar
```

## Architecture

- **Frontend**: React + Vite + TypeScript SPA. No routing library or server-state library is used by design — data fetching is plain `fetch`-based wrapper functions in `src/api/` combined with `useState`/`useEffect` and polling (15s/60s intervals), not React Query or similar. Charts use Recharts; icons use `lucide-react`; PDF export (order lists, cash summaries) is done client-side with `html2canvas` + `jsPDF`. Folder layout: `api/` (backend calls), `components/`, `pages/`, `layouts/`, `hooks/`, `utils/`, `types/`, `styles/`.

- **Backend**: Spring Boot 3 (Java 17 source/target) monolith, conventional layered architecture — `controller/ → service/ → repository/`, with `dto/` and `entity/` kept separate (do not return entities directly from controllers). `config/` and `security/` hold Spring configuration and the JWT auth setup. Auth is stateless JWT (`jjwt`) + bcrypt via Spring Security, with `@PreAuthorize` for the two roles: Employee and Owner/Admin.

- **Database**: PostgreSQL (hosted on Neon). Schema is managed exclusively through Flyway migrations in `backend/src/main/resources/db/migration` — `spring.jpa.hibernate.ddl-auto` is set to `validate`, so schema changes must go through a new Flyway migration file, never through Hibernate auto-DDL.

- **No caching layer, no message bus** — service methods call each other synchronously within the same request. Don't introduce Redis/events/queues without an explicit reason; the app is intentionally kept simple at 2-store scale.

- **Testing**: JUnit 5 + Mockito + H2 in-memory DB (`backend/src/test/resources/application-test.yml` configures H2 in PostgreSQL compatibility mode, with Flyway disabled for tests).

- **Scheduling**: use Spring's built-in `@Scheduled` (already enabled via `@EnableScheduling` on `RetailOpsApplication`) for jobs like daily checklist reset/rollover and order-list generation — no external scheduler.

## Deployment

Frontend deploys to Vercel, backend to Railway, both auto-deploying on push (no manual deploy steps, no Docker/Kubernetes). CI is GitHub Actions (frontend) + Railway's built-in pipeline (backend) — neither exists yet in this repo.
