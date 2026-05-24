# Sinergi Donor Inventory Service

Backend API untuk MVP Inventory Service Sinergi Donor. Service ini mencatat UDD/BDRS, lifecycle kantong darah, agregasi stok, stok kritis, FEFO expiring-soon, dan transfer stok antar unit.

## Stack

- NestJS
- TypeScript strict
- Prisma
- PostgreSQL/Neon
- Swagger
- class-validator

## Setup

1. Install dependencies:

```bash
npm install
```

2. Salin environment:

```bash
copy .env.example .env
```

3. Isi `DATABASE_URL` dengan connection string PostgreSQL/Neon.

4. Generate Prisma Client:

```bash
npm run prisma:generate
```

5. Jalankan migration:

```bash
npm run prisma:migrate
```

6. Seed data:

```bash
npm run prisma:seed
```

7. Run dev server:

```bash
npm run start:dev
```

## URLs

- API base URL: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`
- Demo client: buka `client.html` di browser.
- Postman collection: import `postman/Sinergi_Donor_Inventory.postman_collection.json`
- Postman environment: import `postman/Sinergi_Donor_Local.postman_environment.json`

## Main Endpoints

- `POST /api/v1/units`
- `GET /api/v1/units`
- `GET /api/v1/blood-bags`
- `PATCH /api/v1/blood-bags/:id/status`
- `GET /api/v1/stock/summary`
- `GET /api/v1/stock/critical`
- `GET /api/v1/stock/expiring-soon`
- `POST /api/v1/stock-transfers`
- `PATCH /api/v1/stock-transfers/:id/dispatch`
- `PATCH /api/v1/stock-transfers/:id/complete`
- `PATCH /api/v1/stock-transfers/:id/cancel`

## Scope MVP

Tidak ada auth, Redis, WebSocket, Smart Dispatch, Donor Engagement, Identity Service, atau dashboard. Semua endpoint public untuk kebutuhan sprint MVP.
