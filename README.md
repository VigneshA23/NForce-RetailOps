# NForce RetailOps

Two-store retail operations app: employee checklists and an owner/admin dashboard.

## Structure

- `frontend/` — React + Vite + TypeScript SPA
- `backend/` — Spring Boot 3 (Java 17) API, layered controller/service/repository/dto/entity

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org) (LTS installer includes npm). Verify: `node -v`
- **Java 17+ (JDK)** — [Eclipse Temurin](https://adoptium.net) installer. Verify: `java -version`
- **Maven** — [maven.apache.org](https://maven.apache.org/download.cgi), extract and add its `bin` folder to your PATH. Verify: `mvn -v`
- **PostgreSQL** — either:
  - [Neon](https://neon.tech) (recommended, no local install) — create a free project and copy its connection string into `DATABASE_URL`, or
  - a local Postgres install from [postgresql.org/download](https://www.postgresql.org/download/), then `createdb retailops`

## Frontend

```
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Backend

Requires Java 17+ and a PostgreSQL database (see `backend/.env.example` for connection vars).

```
cd backend
cp .env.example .env
mvn spring-boot:run
```
