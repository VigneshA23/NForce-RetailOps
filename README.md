# NForce RetailOps

Two-store retail operations app: employee checklists and an owner/admin dashboard.

## Structure

- `frontend/` — React + Vite + TypeScript SPA
- `backend/` — Spring Boot 3 (Java 17) API, layered controller/service/repository/dto/entity

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
