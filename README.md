# NForce RetailOps

Retail operations platform. Employees work a daily checklist and count stock; store owners supervise their store, correct records and act on shortages; a platform super-admin manages owners, stores, the task catalogue and the inventory catalogue.

## Structure

- `frontend/` — React 18 + Vite + TypeScript SPA
- `backend/` — Spring Boot 3 (Java 17) API, layered controller/service/repository/dto/entity
- `docs/` — design and audit documents (historical; several are out of date)

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org) (LTS installer includes npm). Verify: `node -v`
- **Java 17+ (JDK)** — [Eclipse Temurin](https://adoptium.net) installer. Verify: `java -version`
- **Maven** — [maven.apache.org](https://maven.apache.org/download.cgi), extract and add its `bin` folder to your PATH. Verify: `mvn -v`
- **PostgreSQL** — either:
  - [Neon](https://neon.tech) (recommended, no local install) — create a free project and copy its connection string into `DATABASE_URL`, or
  - a local Postgres install from [postgresql.org/download](https://www.postgresql.org/download/), then `createdb retailops`

## Setup

There are no `.env.example` files in this repo — create both `.env` files by hand from the tables below.

### Frontend

Create `frontend/.env`:

```
VITE_API_BASE_URL=http://localhost:8080/api
```

That is the only variable the frontend reads. Then:

```
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### Backend

Create `backend/.env` with at least the database and JWT settings:

```
DATABASE_URL=jdbc:postgresql://localhost:5432/retailops
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
JWT_SECRET=<any long random string>
```

Then:

```
cd backend
mvn spring-boot:run  # http://localhost:8080
```

Flyway applies the schema on first start. `ddl-auto` is `validate`, so the database is built entirely from the migrations in `backend/src/main/resources/db/migration`.

#### All backend variables

Everything except the four above has a working default.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/retailops` | Database connection |
| `DATABASE_USERNAME` | `postgres` | Database user |
| `DATABASE_PASSWORD` | `postgres` | Database password |
| `JWT_SECRET` | `change-me-in-env` | Token signing key — **set this** |
| `JWT_EXPIRATION_MS` | `86400000` | Token lifetime ceiling |
| `SESSION_INACTIVITY_TIMEOUT_MINUTES` | `30` | Standard session window |
| `SESSION_REMEMBER_ME_TIMEOUT_MINUTES` | `240` | "Remember me" session window |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allow-list (comma-separated) |
| `APP_BASE_URL` | `http://localhost:5173` | Base for password-reset and account-setup email links |
| `APP_SCHEDULING_ENABLED` | `true` | In-process scheduled jobs |
| `INTERNAL_JOB_SECRET` | *(empty)* | Shared secret for `/internal/jobs/**`; blank returns 503 |
| `RESEND_API_KEY` | *(empty)* | Outbound email via Resend |
| `RESEND_FROM_EMAIL` | `RetailOps <onboarding@resend.dev>` | Resend sender |
| `SES_FROM_EMAIL` | `noreply@nforceone.com` | Sender when running on AWS Lambda (SES) |
| `LOGIN_RATE_LIMIT_ENABLED` | `true` | Login throttling (5 attempts / 15 min) |
| `DB_POOL_MAX_SIZE` / `DB_POOL_MIN_IDLE` | `10` / `2` | Connection pool, tuned for Neon |
| `PORT` | `8080` | Server port |

Without `RESEND_API_KEY`, account-setup and password-reset emails will fail. Account creation still succeeds and returns a temporary password in the response, so local development works without it.

## Tests

```
cd backend  && mvn test                               # 49 classes
cd frontend && npm test                               # 37 files

mvn test -Dtest=ClassName#methodName                  # single backend test
```

Backend tests run against H2 in PostgreSQL compatibility mode with Flyway disabled, so they need no database.

## Known rough edges

- `npm run lint` fails — ESLint is not installed or configured.
- No CI is committed; nothing enforces that tests pass before a merge.
- Migration numbers V25, V51 and V57 are absent. This is expected — Flyway is configured to tolerate the gaps because the team shares one dev database across branches. Use the next unused number.
- Date boundaries use the server's default JVM timezone; there is no per-store timezone.

## Further reading

`CLAUDE.md` documents the architecture, conventions and the traps worth knowing before changing things.
