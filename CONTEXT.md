# Sinergi Donor — Inventory Service

> **Context file untuk AI coding assistant** (Claude Code, Cursor, GitHub Copilot).
> Baca file ini sebelum melakukan code generation, refactoring, atau debugging.
> Update file ini setiap kali ada perubahan arsitektur, schema, atau business rule.

---

## 📌 0. Quick Reference for AI

**Stack:** NestJS 11.1.23 · TypeScript 6.0.3 strict · Prisma 7.8.0 · PostgreSQL 18.4 (Neon) · Swagger 11.4.4 · class-validator 0.15.1 · Node.js 24 LTS · Redis (deferred to later iteration)

**Architecture Pattern:** Layered (Controller → Service → Repository) within NestJS module system

**Project structure rule:** Setiap domain resource (units, blood-bags, stock-transfers, stock) adalah satu NestJS module dengan struktur: `controller.ts`, `service.ts`, `*.dto.ts`, `*.module.ts`. Repository layer pakai `PrismaService` directly — TIDAK perlu repository class terpisah kecuali query complex (aggregation/raw SQL).

**Authentication:** Skipped untuk MVP sprint. Semua endpoint public. Auth nanti ditambah via guard di iterasi berikutnya.

**Critical AI directives:**
- ❌ JANGAN bikin frontend/UI. Backend API only + 1 file `client.html` di root.
- ❌ JANGAN scope creep ke Smart Dispatch, Donor Engagement, atau Identity Service. Cuma Inventory.
- ❌ JANGAN pakai SQLite. Postgres only (via Prisma + Neon connection string).
- ❌ JANGAN refactor di tengah sprint kecuali bug critical. Ship working code first.
- ✅ PAKAI Swagger decorators (`@ApiProperty`, `@ApiOperation`, `@ApiResponse`, `@ApiTags`) di SEMUA controller dan DTO. Dokumentasi auto-generate adalah deliverable.
- ✅ PAKAI class-validator di SEMUA DTO. ValidationPipe sudah global di `main.ts`.
- ✅ PAKAI BigInt/Decimal hati-hati — Prisma serialize ke JSON butuh transformer.

---

## 1. Problem Statement & Goal

### Problem
Sistem inventaris darah di **UDD PMI** (Unit Donor Darah Palang Merah Indonesia) dan **BDRS** (Bank Darah Rumah Sakit) berjalan **siloed** — tidak ada pertukaran data real-time. Pengecekan stok saat kondisi **cito** (darurat) dilakukan manual via telepon/chat, butuh **>3 jam**. Akibatnya:

- Satu unit overstock → darah expired (wastage)
- Unit lain krisis stok → pasien telat ditangani
- Tidak ada visibility nasional terhadap stok darah

### Goal Sinergi Donor (Sistem Penuh)
Platform integrasi rantai pasok darah nasional dengan 4 microservice:
1. **Inventory Service** ← **fokus implementasi**
2. Smart Dispatch Service (geospatial matching) — design only
3. Donor Engagement Service (broadcast pendonor) — design only
4. Identity & Validation Service (auth + Dukcapil) — design only

### Goal Inventory Service (MVP Scope)
Membangun **single source of truth** untuk stok darah:
- Mencatat unit donor (UDD/BDRS) beserta koordinat geografis
- Mengelola lifecycle kantong darah (register → available → reserved → in_transit → used/expired)
- Agregasi stok per golongan darah, per unit, per wilayah
- Deteksi stok kritis (di bawah threshold) sebagai trigger Donor Engagement
- Deteksi kantong mendekati expired (FEFO) sebagai trigger transfer
- Orkestrasi transfer stok antar unit

### Success Criteria (Sprint MVP)
- ✅ Semua endpoint berfungsi via Swagger UI di `/docs`
- ✅ Postman collection complete + sharable
- ✅ Client HTML demo bisa hit semua endpoint
- ✅ Business rules tervalidasi (no transfer expired bag, no double-reserve, FEFO ordering correct)
- ✅ Response time `<2s` untuk semua endpoint dengan dataset realistic (~1000 blood bags)

---

## 2. Glossary — Domain Terms

AI assistant: **selalu pakai istilah ini di code, DTO, variable name, dan dokumentasi**.

| Term | Definisi | Catatan untuk Code |
|---|---|---|
| **UDD** | Unit Donor Darah (PMI). Tempat pengambilan donasi. | `UnitType.UDD` |
| **BDRS** | Bank Darah Rumah Sakit. Konsumen stok. | `UnitType.BDRS` |
| **Pendonor** | Individu yang mendonorkan darah | Tidak ada di Inventory Service (ada di Identity Service) |
| **Cito** | Permintaan darurat (out-of-scope, tapi muncul di context) | Tidak di-handle Inventory; tapi `reserved` status bisa di-trigger oleh Dispatch |
| **FEFO** | First Expired First Out. Strategi alokasi: kantong dengan expiry terdekat dipakai/transferred lebih dulu. | Implementasi di `FefoService` / `StockService` |
| **Wastage** | Darah terbuang karena expired sebelum dipakai | Metric: `(expired_bags / total_bags) * 100%` |
| **Whole Blood (WB)** | Darah utuh, expiry ~35 hari | `ComponentType.WHOLE_BLOOD` |
| **PRC** | Packed Red Cells, expiry ~42 hari | `ComponentType.PRC` |
| **TC** | Thrombocyte Concentrate / Trombosit, expiry ~5 hari | `ComponentType.TC` |
| **FFP** | Fresh Frozen Plasma, expiry ~1 tahun (frozen) | `ComponentType.FFP` |
| **Golongan Darah** | A, B, AB, O — masing-masing positif/negatif (Rhesus) | `BloodType` enum: `A_POS`, `A_NEG`, dst |
| **Cold Chain** | Pengelolaan suhu konsisten 2-6°C selama distribusi | Out-of-scope Inventory; relevan di Dispatch |
| **Threshold Kritis** | Batas minimum stok per golongan, configurable per unit | Default: 5 kantong per golongan |
| **Transfer Stok** | Pemindahan kantong dari unit asal ke unit tujuan | Status: `PENDING` → `IN_TRANSIT` → `COMPLETED` / `CANCELLED` |
| **Reserve / Lock** | Status kantong "dipesan" oleh permintaan, tidak boleh ditransfer/dipakai lain | Status: `RESERVED` |

---

## 3. Tech Stack — Versions & Rationale

```yaml
runtime: Node.js 24 LTS (Active)
language: TypeScript 6.0.3 (strict mode ON, v6 untuk production, v7 beta belum stable)
framework: NestJS 11.1.23 (stick to v11, v12 masih draft)
orm: Prisma 7.8.0 (latest stable, TypeScript-based runtime, no Rust)
database: PostgreSQL 18.4 (hosted di Neon, auto pakai versi terbaru)
api_docs: '@nestjs/swagger 11.4.4' (OpenAPI 3.0, sync dengan NestJS 11)
validation: 'class-validator 0.15.1' + 'class-transformer'
config: '@nestjs/config' (untuk .env loading)
testing: Jest (built-in NestJS) — minimal smoke tests
deployment: Railway.app (opsional, kalau sempat)
```

### Why these?

- **NestJS**: Layered architecture built-in, Swagger auto-gen via decorators, DI container, mature ecosystem. Sesuai pola yang dipakai contoh dosen.
- **Prisma**: Type-safe queries, migration first-class, schema-as-code. Lo sudah expert dari Temucita. v7 memiliki TypeScript-based runtime (no Rust), 3x faster, 90% smaller bundle, hati-hati ada breaking changes vs v6.
- **PostgreSQL**: Aggregation queries kompleks, transaction isolation untuk prevent race condition di reserve/transfer, future-ready untuk PostGIS (geospatial extension untuk Smart Dispatch).
- **Neon**: Free serverless Postgres (100 CU-hours/month, 0.5 GB storage, branching, scale-to-zero), no Docker needed for local dev, branch DB untuk testing. Acquired by Databricks Mei 2025.

### Forbidden/Discouraged
- ❌ **SQLite** — production-incompatible untuk aggregation queries
- ❌ **TypeORM** — Prisma lebih sederhana untuk MVP
- ❌ **Express raw** — kehilangan benefit Swagger auto-gen
- ⚠️ **Redis** — design-only di MVP, deferred ke iterasi event-driven (kalau sempat)

---

## 4. Project Structure

```
sinergi-donor-inventory/
├── prisma/
│   ├── schema.prisma           # Single schema file
│   ├── seed.ts                 # Seed data: 5 units, 50 blood bags
│   └── migrations/             # Auto-generated by Prisma
├── src/
│   ├── main.ts                 # Bootstrap + Swagger setup + global pipes
│   ├── app.module.ts           # Root module
│   ├── prisma/
│   │   ├── prisma.service.ts   # PrismaClient injectable wrapper
│   │   └── prisma.module.ts    # Global module exporting PrismaService
│   ├── common/
│   │   ├── enums/
│   │   │   ├── blood-type.enum.ts
│   │   │   ├── component-type.enum.ts
│   │   │   ├── blood-bag-status.enum.ts
│   │   │   ├── unit-type.enum.ts
│   │   │   └── transfer-status.enum.ts
│   │   ├── dto/
│   │   │   ├── pagination.dto.ts        # ?page=&limit=
│   │   │   └── api-response.dto.ts      # standard wrapper
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts  # global exception → consistent JSON
│   │   └── interceptors/
│   │       └── response.interceptor.ts   # wrap all responses with { success, data, message }
│   ├── units/
│   │   ├── units.controller.ts
│   │   ├── units.service.ts
│   │   ├── units.module.ts
│   │   └── dto/
│   │       ├── create-unit.dto.ts
│   │       ├── update-unit.dto.ts
│   │       └── filter-units.dto.ts
│   ├── blood-bags/
│   │   ├── blood-bags.controller.ts
│   │   ├── blood-bags.service.ts
│   │   ├── blood-bags.module.ts
│   │   └── dto/
│   │       ├── create-blood-bag.dto.ts
│   │       ├── update-blood-bag-status.dto.ts
│   │       └── filter-blood-bags.dto.ts
│   ├── stock/
│   │   ├── stock.controller.ts
│   │   ├── stock.service.ts           # aggregation logic + FEFO + critical detection
│   │   ├── stock.module.ts
│   │   └── dto/
│   │       ├── stock-summary-response.dto.ts
│   │       ├── critical-stock-response.dto.ts
│   │       └── expiring-soon-query.dto.ts
│   └── stock-transfers/
│       ├── stock-transfers.controller.ts
│       ├── stock-transfers.service.ts
│       ├── stock-transfers.module.ts
│       └── dto/
│           ├── create-transfer.dto.ts
│           └── filter-transfers.dto.ts
├── client.html                  # Single-file demo client (vanilla JS + fetch)
├── .env                         # DATABASE_URL, PORT
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── CONTEXT.md                   # THIS FILE
```

### Naming Conventions
- **Files**: `kebab-case.ts` (e.g., `blood-bags.controller.ts`)
- **Classes**: `PascalCase` (e.g., `BloodBagsService`, `CreateBloodBagDto`)
- **Module folder**: plural, kebab-case (e.g., `blood-bags/`, `stock-transfers/`)
- **Database tables**: `snake_case`, plural (e.g., `blood_bags`, `stock_transfers`)
- **Enums**: `SCREAMING_SNAKE_CASE` values (e.g., `BloodType.A_POS`)
- **Endpoints**: `kebab-case`, plural (e.g., `/blood-bags`, `/stock-transfers`)

---

## 5. Database Schema (Prisma)

### Full `schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== ENUMS ====================

enum UnitType {
  UDD     // Unit Donor Darah (sumber donasi)
  BDRS    // Bank Darah Rumah Sakit (konsumen)
}

enum BloodType {
  A_POS   // A+
  A_NEG   // A-
  B_POS   // B+
  B_NEG   // B-
  AB_POS  // AB+
  AB_NEG  // AB-
  O_POS   // O+
  O_NEG   // O-
}

enum ComponentType {
  WHOLE_BLOOD   // Darah utuh, ~35 hari shelf life
  PRC           // Packed Red Cells, ~42 hari
  TC            // Thrombocyte Concentrate, ~5 hari
  FFP           // Fresh Frozen Plasma, ~365 hari
}

enum BloodBagStatus {
  AVAILABLE     // Siap dipakai/transfer
  RESERVED      // Sudah di-lock oleh request, no other operation allowed
  IN_TRANSIT    // Sedang ditransfer ke unit lain
  USED          // Sudah dipakai untuk transfusi pasien
  EXPIRED       // Lewat tanggal expiry (auto / manual mark)
  DISCARDED     // Dibuang karena kontaminasi/kerusakan
}

enum TransferStatus {
  PENDING       // Permintaan transfer dibuat, belum diberangkatkan
  IN_TRANSIT    // Sedang dalam perjalanan
  COMPLETED     // Tiba di unit tujuan, kantong jadi AVAILABLE di unit baru
  CANCELLED     // Dibatalkan sebelum diberangkatkan
}

enum TransferReason {
  CRITICAL_REQUEST    // Permintaan dari unit yang stok kritis
  FEFO_REBALANCE      // Re-balance otomatis berdasarkan FEFO
  MANUAL              // Inisiatif staff UDD
}

// ==================== MODELS ====================

model Unit {
  id          String   @id @default(cuid())
  code        String   @unique                 // e.g., "UDD-MLG-001", "BDRS-RSSA-001"
  name        String                            // e.g., "UDD PMI Kota Malang"
  type        UnitType
  address     String
  city        String
  province    String
  latitude    Decimal  @db.Decimal(10, 7)       // -7.9666... (Malang)
  longitude   Decimal  @db.Decimal(10, 7)       // 112.6326...
  phone       String?
  email       String?
  criticalThreshold Int @default(5)             // Minimum bags per blood type before flagged critical
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  bloodBags        BloodBag[]
  transfersFrom    StockTransfer[] @relation("FromUnit")
  transfersTo      StockTransfer[] @relation("ToUnit")

  @@index([type])
  @@index([city, province])
  @@map("units")
}

model BloodBag {
  id              String         @id @default(cuid())
  serialNumber    String         @unique          // e.g., "BB-2026-00001"
  bloodType       BloodType
  component       ComponentType
  volumeMl        Int                              // Volume in milliliters (typical: 250-450)
  collectionDate  DateTime                         // Tanggal pengambilan donasi
  expiryDate      DateTime                         // Auto-calculated berdasarkan component
  status          BloodBagStatus @default(AVAILABLE)
  unitId          String                           // Lokasi saat ini
  donorId         String?                          // FK ke Identity Service (nullable, anonymous OK)
  notes           String?                          // Free-text catatan
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  // Relations
  unit            Unit           @relation(fields: [unitId], references: [id])
  transfer        StockTransfer? @relation(fields: [transferId], references: [id])
  transferId      String?

  @@index([unitId, status])
  @@index([bloodType, status])
  @@index([expiryDate])              // For FEFO queries
  @@index([status, expiryDate])      // Composite for critical+expiring queries
  @@map("blood_bags")
}

model StockTransfer {
  id            String          @id @default(cuid())
  transferCode  String          @unique           // e.g., "TRF-2026-00001"
  fromUnitId    String
  toUnitId      String
  reason        TransferReason
  status        TransferStatus  @default(PENDING)
  notes         String?
  initiatedBy   String?                            // User ID (nullable for MVP)
  initiatedAt   DateTime        @default(now())
  dispatchedAt  DateTime?                          // Saat status → IN_TRANSIT
  completedAt   DateTime?                          // Saat status → COMPLETED
  cancelledAt   DateTime?                          // Saat status → CANCELLED
  cancelReason  String?

  // Relations
  fromUnit      Unit            @relation("FromUnit", fields: [fromUnitId], references: [id])
  toUnit        Unit            @relation("ToUnit", fields: [toUnitId], references: [id])
  bloodBags     BloodBag[]                         // Multiple bags per transfer

  @@index([fromUnitId, status])
  @@index([toUnitId, status])
  @@index([status, initiatedAt])
  @@map("stock_transfers")
}
```

### Key Schema Decisions

- **`Decimal(10, 7)` for lat/lng**: Cukup precision untuk ~1cm accuracy, future-ready untuk PostGIS migration.
- **`cuid()` for IDs**: Collision-resistant, URL-safe, sortable. Tidak pakai UUID karena pendek dan lebih mudah dibaca di log.
- **`serialNumber` & `transferCode`**: Business identifier (human-readable). Generated di service layer, bukan database default.
- **Composite indexes**: Khusus untuk query yang sering: `unit + status`, `bloodType + status`, `status + expiryDate`.
- **`donorId` nullable**: Inventory Service tidak punya FK ke Identity Service (loose coupling antar microservice). Stored as plain string.
- **No soft delete untuk MVP**: Cuma `cancelled` status untuk transfer. `Discarded` status untuk bags yang dibuang.

### Seed Data Spec
File `prisma/seed.ts` harus generate:
- **5 units**: 3 UDD (Malang, Surabaya, Jakarta) + 2 BDRS (RSSA Malang, RSCM Jakarta) dengan koordinat real.
- **50 blood bags**: distribusi seimbang antar golongan & komponen, dengan **5 bags expiring dalam 3 hari** (FEFO test), **3 bags already RESERVED** (lock test), distribusi unit yang membuat **1 unit critical pada O_NEG**.
- **2 sample transfers**: 1 COMPLETED, 1 PENDING.

---

## 6. API Endpoints Specification

**Base URL:** `http://localhost:3000/api/v1`
**Content-Type:** `application/json`
**Response Envelope (untuk semua endpoint):**

```typescript
// Success
{
  "success": true,
  "data": <T>,
  "message": "Optional human-readable message"
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR" | "NOT_FOUND" | "BUSINESS_RULE_VIOLATION" | "INTERNAL_ERROR",
    "message": "Human-readable error",
    "details": { /* optional validation errors per field */ }
  }
}
```

Diimplementasikan via `ResponseInterceptor` (success) + `HttpExceptionFilter` (error).

### 6.1 Units Endpoints

#### `POST /units`
Buat unit baru (UDD atau BDRS).

**Request Body:**
```json
{
  "code": "UDD-MLG-001",
  "name": "UDD PMI Kota Malang",
  "type": "UDD",
  "address": "Jl. Buring No. 10",
  "city": "Malang",
  "province": "Jawa Timur",
  "latitude": -7.9666,
  "longitude": 112.6326,
  "phone": "+62341123456",
  "email": "udd.malang@pmi.or.id",
  "criticalThreshold": 5
}
```

**Validations:**
- `code` unique, format `^[A-Z]+-[A-Z]+-\d{3}$`
- `type` in `["UDD", "BDRS"]`
- `latitude` between -90 and 90, `longitude` between -180 and 180
- `criticalThreshold` >= 1, default 5

**Response 201:** Unit object with `id`, `createdAt`, `updatedAt`.

#### `GET /units`
List all units with optional filters.

**Query Params:**
- `type?`: `UDD` | `BDRS`
- `city?`: string (case-insensitive contains)
- `province?`: string
- `isActive?`: boolean (default `true`)
- `page?`: int (default 1)
- `limit?`: int (default 20, max 100)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [/* Unit[] */],
    "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
  }
}
```

#### `GET /units/:id`
Get single unit detail. Includes **stock summary per blood type** (computed).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "...", "code": "UDD-MLG-001", "name": "...", /* full unit */
    "stockSummary": {
      "A_POS": { "available": 12, "reserved": 2, "expiringSoonDays7": 1 },
      "O_NEG": { "available": 3, "reserved": 0, "expiringSoonDays7": 0 },
      /* ... all 8 blood types ... */
    }
  }
}
```

#### `PATCH /units/:id`
Update unit (partial). Tidak bisa ubah `code` setelah created.

#### `DELETE /units/:id`
Soft delete (set `isActive = false`). Reject jika masih ada `bloodBags` dengan status `AVAILABLE` atau `RESERVED`.

---

### 6.2 Blood Bags Endpoints

#### `POST /blood-bags`
Register kantong darah baru (hasil donasi).

**Request Body:**
```json
{
  "serialNumber": "BB-2026-00001",
  "bloodType": "O_NEG",
  "component": "WHOLE_BLOOD",
  "volumeMl": 350,
  "collectionDate": "2026-05-24T08:30:00Z",
  "unitId": "clx...",
  "donorId": "donor-cuid-from-identity-service",
  "notes": "Routine donation"
}
```

**Validations:**
- `serialNumber` unique, format `^BB-\d{4}-\d{5}$`
- `volumeMl` between 200 and 500
- `collectionDate` not in the future
- `unitId` must reference existing active Unit
- **`expiryDate` AUTO-COMPUTED** by service berdasarkan `component`:
  - `WHOLE_BLOOD`: `collectionDate + 35 days`
  - `PRC`: `collectionDate + 42 days`
  - `TC`: `collectionDate + 5 days`
  - `FFP`: `collectionDate + 365 days`
- **Status auto-set** to `AVAILABLE`

**Response 201:** Blood bag object dengan computed `expiryDate`.

#### `GET /blood-bags`
List with filters + pagination.

**Query Params:**
- `unitId?`: string
- `bloodType?`: enum value
- `component?`: enum value
- `status?`: enum value (default: exclude `EXPIRED`, `USED`, `DISCARDED`)
- `expiringInDays?`: int (e.g., 7 → expires within 7 days from now)
- `sortBy?`: `expiryDate` | `createdAt` | `collectionDate` (default: `expiryDate ASC` for FEFO)
- `page?`, `limit?`

**Response 200:** Paginated list.

#### `GET /blood-bags/:id`
Get single blood bag dengan unit info populated.

#### `PATCH /blood-bags/:id/status`
Update status (state machine, see §7.2).

**Request Body:**
```json
{
  "status": "RESERVED",
  "notes": "Reserved for cito request CR-2026-001"
}
```

**Validation:** Status transition harus valid (see state machine §7.2).

#### `DELETE /blood-bags/:id`
Hard delete — hanya bisa kalau status `EXPIRED` atau `DISCARDED` (untuk cleanup). Reject jika `AVAILABLE`/`RESERVED`/`IN_TRANSIT`/`USED`.

---

### 6.3 Stock Aggregation Endpoints (Read-Only)

#### `GET /stock/summary`
Agregasi stok nasional per golongan darah.

**Query Params:**
- `groupBy?`: `bloodType` (default) | `component` | `bloodTypeAndComponent`
- `includeReserved?`: boolean (default `false`)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "totalUnits": 5,
    "totalBags": 47,
    "summary": [
      { "bloodType": "A_POS", "available": 8, "reserved": 1, "expiringSoonDays7": 2 },
      { "bloodType": "A_NEG", "available": 4, "reserved": 0, "expiringSoonDays7": 1 },
      /* ... 8 entries total ... */
    ],
    "generatedAt": "2026-05-24T10:00:00Z"
  }
}
```

#### `GET /stock/by-unit/:unitId`
Detail stok per unit (lebih detail dari `GET /units/:id`).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "unit": { /* full Unit */ },
    "breakdown": [
      {
        "bloodType": "O_NEG",
        "component": "PRC",
        "available": 3,
        "reserved": 0,
        "totalVolumeMl": 1050,
        "nearestExpiryDate": "2026-06-15T00:00:00Z"
      },
      /* ... */
    ]
  }
}
```

#### `GET /stock/critical`
Wilayah/unit yang stok-nya **di bawah `criticalThreshold` Unit**.

**Query Params:**
- `bloodType?`: filter spesifik golongan
- `unitType?`: `UDD` | `BDRS`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "criticalCount": 3,
    "items": [
      {
        "unitId": "...",
        "unitCode": "UDD-MLG-001",
        "unitName": "UDD PMI Kota Malang",
        "bloodType": "O_NEG",
        "availableCount": 2,
        "criticalThreshold": 5,
        "deficit": 3,
        "city": "Malang"
      }
    ]
  }
}
```

**Business note:** Endpoint ini yang akan di-poll oleh **Donor Engagement Service** (di iterasi selanjutnya) untuk men-trigger broadcast pendonor.

#### `GET /stock/expiring-soon`
Kantong yang akan expired dalam N hari ke depan (untuk FEFO transfer candidate).

**Query Params:**
- `days`: int (required, default 7, max 30)
- `unitId?`: filter unit spesifik
- `bloodType?`: filter golongan

**Response 200:**
```json
{
  "success": true,
  "data": {
    "thresholdDays": 7,
    "totalExpiringSoon": 5,
    "items": [
      {
        "bloodBag": { /* full BloodBag */ },
        "daysUntilExpiry": 2,
        "unit": { "id": "...", "code": "...", "name": "..." },
        "transferSuggestions": [
          { "toUnitId": "...", "toUnitName": "...", "distanceKm": 95.3, "reason": "Critical stock at destination" }
        ]
      }
    ]
  }
}
```

**Note**: `transferSuggestions` bisa cuma return unit yang lagi critical untuk golongan yang sama. Distance calculation pakai Haversine sederhana (formulanya di §7.4).

---

### 6.4 Stock Transfer Endpoints

#### `POST /stock-transfers`
Buat transfer request.

**Request Body:**
```json
{
  "fromUnitId": "...",
  "toUnitId": "...",
  "bloodBagIds": ["...", "..."],
  "reason": "CRITICAL_REQUEST",
  "notes": "Transfer untuk memenuhi krisis O_NEG di BDRS RSSA"
}
```

**Validations & Business Rules (see §7.3):**
- `fromUnitId !== toUnitId`
- Semua `bloodBagIds` harus exist, status `AVAILABLE`, dan `unitId === fromUnitId`
- Tidak boleh transfer bag yang sudah `EXPIRED`
- Atomic: semua bag jadi `IN_TRANSIT` dan link ke `transferId` dalam 1 transaction

**Response 201:** Transfer object dengan generated `transferCode`.

#### `GET /stock-transfers`
List with filters.

**Query Params:**
- `status?`: enum
- `fromUnitId?`: string
- `toUnitId?`: string
- `reason?`: enum
- `dateFrom?`, `dateTo?`: ISO date

#### `GET /stock-transfers/:id`
Detail with `bloodBags` populated.

#### `PATCH /stock-transfers/:id/dispatch`
Mark sebagai `IN_TRANSIT` (saat kurir berangkat).

**Validation:** Status saat ini harus `PENDING`.

#### `PATCH /stock-transfers/:id/complete`
Mark sebagai `COMPLETED`. Semua `bloodBags` dipindah ke `toUnit` dan status kembali ke `AVAILABLE`.

**Atomic operation (transaction):**
1. Transfer.status = `COMPLETED`, set `completedAt`
2. Setiap BloodBag: `unitId = toUnitId`, `status = AVAILABLE`, clear `transferId`

#### `PATCH /stock-transfers/:id/cancel`
Cancel transfer (hanya jika `PENDING`).

**Body:** `{ "cancelReason": "..." }`

**Effect:** Bag-bag yang sudah linked balik ke `AVAILABLE` di `fromUnit`.

---

## 7. Business Rules (Critical Logic)

### 7.1 Expiry Date Auto-Calculation

```typescript
// di blood-bags.service.ts
private calculateExpiryDate(collectionDate: Date, component: ComponentType): Date {
  const SHELF_LIFE_DAYS: Record<ComponentType, number> = {
    WHOLE_BLOOD: 35,
    PRC: 42,
    TC: 5,
    FFP: 365,
  };
  const expiry = new Date(collectionDate);
  expiry.setDate(expiry.getDate() + SHELF_LIFE_DAYS[component]);
  return expiry;
}
```

**Rule:** `expiryDate` **always** computed at create. **TIDAK PERNAH** di-set manual via API. Update component would require new bag (immutable).

### 7.2 Blood Bag Status State Machine

```
        ┌─────────────┐
        │  AVAILABLE  │ ◄────────────┐
        └──────┬──────┘              │
               │                     │
       ┌───────┴────────┐            │
       ▼                ▼            │
  ┌─────────┐    ┌────────────┐      │
  │RESERVED │    │ IN_TRANSIT │──────┘  (transfer cancelled)
  └────┬────┘    └─────┬──────┘
       │               │
       ▼               ▼  (transfer completed → moves to AVAILABLE at new unit)
  ┌─────────┐
  │  USED   │  (terminal)
  └─────────┘

  Any state → EXPIRED (auto by expiry check) — terminal
  Any state → DISCARDED (manual, contamination) — terminal
```

**Allowed transitions (validate in service):**
```typescript
const ALLOWED: Record<BloodBagStatus, BloodBagStatus[]> = {
  AVAILABLE:  ['RESERVED', 'IN_TRANSIT', 'USED', 'EXPIRED', 'DISCARDED'],
  RESERVED:   ['AVAILABLE', 'USED', 'EXPIRED', 'DISCARDED'],         // can be released back
  IN_TRANSIT: ['AVAILABLE', 'DISCARDED'],                            // completed=AVAILABLE@newUnit, lost=DISCARDED
  USED:       [],                                                     // terminal
  EXPIRED:    ['DISCARDED'],                                          // can mark for cleanup
  DISCARDED:  [],                                                     // terminal
};

if (!ALLOWED[currentStatus].includes(newStatus)) {
  throw new BadRequestException(
    `Cannot transition from ${currentStatus} to ${newStatus}`
  );
}
```

### 7.3 Transfer Business Rules

**On Create (`POST /stock-transfers`):**

```typescript
// All in single Prisma transaction
await prisma.$transaction(async (tx) => {
  // 1. Validate units exist and different
  if (fromUnitId === toUnitId) throw BadRequest('Same source and destination');

  const [fromUnit, toUnit] = await Promise.all([
    tx.unit.findUnique({ where: { id: fromUnitId } }),
    tx.unit.findUnique({ where: { id: toUnitId } }),
  ]);
  if (!fromUnit || !fromUnit.isActive) throw NotFound('Source unit');
  if (!toUnit || !toUnit.isActive) throw NotFound('Destination unit');

  // 2. Validate all bloodBags
  const bags = await tx.bloodBag.findMany({
    where: { id: { in: bloodBagIds } },
  });

  if (bags.length !== bloodBagIds.length) throw NotFound('Some bags not found');

  for (const bag of bags) {
    if (bag.unitId !== fromUnitId) {
      throw BadRequest(`Bag ${bag.serialNumber} not in source unit`);
    }
    if (bag.status !== 'AVAILABLE') {
      throw BadRequest(`Bag ${bag.serialNumber} is ${bag.status}, must be AVAILABLE`);
    }
    if (bag.expiryDate <= new Date()) {
      throw BadRequest(`Bag ${bag.serialNumber} is already expired`);
    }
  }

  // 3. Generate transferCode
  const transferCode = await generateTransferCode(tx); // e.g., TRF-2026-00001

  // 4. Create transfer + update all bags atomically
  const transfer = await tx.stockTransfer.create({
    data: { transferCode, fromUnitId, toUnitId, reason, notes, status: 'PENDING' },
  });

  await tx.bloodBag.updateMany({
    where: { id: { in: bloodBagIds } },
    data: { transferId: transfer.id, status: 'IN_TRANSIT' },
  });

  return transfer;
});
```

**On Complete (`PATCH /stock-transfers/:id/complete`):**

```typescript
await prisma.$transaction(async (tx) => {
  const transfer = await tx.stockTransfer.findUnique({
    where: { id }, include: { bloodBags: true }
  });
  if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'PENDING') {
    throw BadRequest(`Cannot complete ${transfer.status} transfer`);
  }

  await tx.stockTransfer.update({
    where: { id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  await tx.bloodBag.updateMany({
    where: { transferId: id },
    data: {
      unitId: transfer.toUnitId,
      status: 'AVAILABLE',
      transferId: null,
    },
  });
});
```

**On Cancel:** Bags balik ke `AVAILABLE`, `transferId = null`, `unitId` tetap di `fromUnit`.

### 7.4 Haversine Distance (untuk `expiring-soon` suggestions)

```typescript
// di common/utils/geo.util.ts
export function haversineDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
```

**Catatan untuk AI:** Hindari premature optimization. Untuk MVP cukup loop semua unit di-memory. Saat scale, baru pikirkan PostGIS atau spatial index.

### 7.5 Critical Stock Detection Algorithm

```typescript
// di stock.service.ts
async detectCriticalStock(): Promise<CriticalStockItem[]> {
  const units = await this.prisma.unit.findMany({
    where: { isActive: true },
    include: {
      bloodBags: {
        where: { status: 'AVAILABLE' },
      },
    },
  });

  const critical: CriticalStockItem[] = [];

  for (const unit of units) {
    // Group bags by bloodType
    const grouped = new Map<BloodType, number>();
    for (const bag of unit.bloodBags) {
      grouped.set(bag.bloodType, (grouped.get(bag.bloodType) ?? 0) + 1);
    }

    // Check each blood type against threshold
    for (const bloodType of Object.values(BloodType)) {
      const count = grouped.get(bloodType) ?? 0;
      if (count < unit.criticalThreshold) {
        critical.push({
          unitId: unit.id,
          unitCode: unit.code,
          unitName: unit.name,
          bloodType,
          availableCount: count,
          criticalThreshold: unit.criticalThreshold,
          deficit: unit.criticalThreshold - count,
          city: unit.city,
        });
      }
    }
  }

  return critical;
}
```

### 7.6 Expiry Auto-Update (Background Concern)

**Untuk MVP**: Tidak ada cron job. Status `EXPIRED` ditandai **lazy**: setiap query `findMany` di service include filter `OR: [{ status: 'EXPIRED' }, { expiryDate: { gt: now } }]` untuk hide bags yang seharusnya expired.

**Atau** (preferred for clarity), tambah `@nestjs/schedule` dengan satu `@Cron('0 0 * * *')` (daily midnight) yang update semua bag dengan `expiryDate <= now AND status IN (AVAILABLE, RESERVED)` ke `EXPIRED`.

AI assistant: implementasi cron opsional, **defer ke akhir sprint** jika masih ada waktu.

---

## 8. Coding Conventions

### 8.1 NestJS Patterns

**Controller (thin):**
```typescript
@ApiTags('Blood Bags')
@Controller({ path: 'blood-bags', version: '1' })
export class BloodBagsController {
  constructor(private readonly service: BloodBagsService) {}

  @Post()
  @ApiOperation({ summary: 'Register new blood bag from donation' })
  @ApiResponse({ status: 201, type: BloodBagResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() dto: CreateBloodBagDto): Promise<BloodBag> {
    return this.service.create(dto);
  }

  // ... other endpoints
}
```

**Service (business logic):**
```typescript
@Injectable()
export class BloodBagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBloodBagDto): Promise<BloodBag> {
    // 1. Validate (beyond DTO validation)
    await this.assertUnitExists(dto.unitId);
    await this.assertSerialNumberUnique(dto.serialNumber);

    // 2. Compute derived fields
    const expiryDate = this.calculateExpiryDate(dto.collectionDate, dto.component);

    // 3. Persist
    return this.prisma.bloodBag.create({
      data: { ...dto, expiryDate, status: BloodBagStatus.AVAILABLE },
    });
  }

  // Private helpers below public methods
  private async assertUnitExists(unitId: string): Promise<void> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit || !unit.isActive) {
      throw new NotFoundException(`Unit ${unitId} not found or inactive`);
    }
  }

  private calculateExpiryDate(collectionDate: Date, component: ComponentType): Date {
    // ... (see §7.1)
  }
}
```

**DTO (validation + Swagger):**
```typescript
export class CreateBloodBagDto {
  @ApiProperty({ example: 'BB-2026-00001', description: 'Unique serial number' })
  @IsString()
  @Matches(/^BB-\d{4}-\d{5}$/, { message: 'Format must be BB-YYYY-NNNNN' })
  serialNumber: string;

  @ApiProperty({ enum: BloodType, example: BloodType.O_NEG })
  @IsEnum(BloodType)
  bloodType: BloodType;

  @ApiProperty({ enum: ComponentType, example: ComponentType.WHOLE_BLOOD })
  @IsEnum(ComponentType)
  component: ComponentType;

  @ApiProperty({ example: 350, minimum: 200, maximum: 500 })
  @IsInt()
  @Min(200)
  @Max(500)
  volumeMl: number;

  @ApiProperty({ example: '2026-05-24T08:30:00Z' })
  @IsDateString()
  collectionDate: string;

  @ApiProperty({ example: 'clx123...' })
  @IsString()
  unitId: string;

  @ApiPropertyOptional({ example: 'donor-cuid' })
  @IsOptional()
  @IsString()
  donorId?: string;

  @ApiPropertyOptional({ example: 'Routine donation' })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

### 8.2 Error Handling

**Use NestJS built-in exceptions:**
- `BadRequestException` → 400 (validation, business rule violation)
- `NotFoundException` → 404 (entity not found)
- `ConflictException` → 409 (unique constraint, status conflict)
- `UnprocessableEntityException` → 422 (semantic validation)
- `InternalServerErrorException` → 500 (unexpected)

**JANGAN** lempar generic `Error` — selalu spesifik.

**Global HttpExceptionFilter** akan format ke envelope:
```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    response.status(status).json({
      success: false,
      error: {
        code: this.mapStatusToCode(status),
        message: exceptionResponse.message ?? exception.message,
        details: exceptionResponse.errors ?? undefined,
      },
    });
  }
}
```

### 8.3 Prisma Best Practices

- ✅ **Always use transactions** untuk multi-table writes (transfers, status updates)
- ✅ **Select only needed fields** untuk list endpoint (performance): `select: { id: true, name: true, ... }`
- ✅ **Include relations selectively**: `include: { unit: { select: { id: true, name: true } } }`
- ✅ **Use `findUniqueOrThrow`** ketika expecting exactly one
- ❌ **JANGAN N+1**: kalau loop array dan query inside loop, refactor pake `findMany` + `Map`
- ❌ **JANGAN `findMany()` tanpa `take`/`limit`** kecuali confidently small dataset

### 8.4 Logging

Pakai NestJS built-in `Logger`:
```typescript
private readonly logger = new Logger(BloodBagsService.name);

this.logger.log(`Created blood bag ${bag.serialNumber}`);
this.logger.warn(`Critical stock detected: ${unitCode} - ${bloodType}`);
this.logger.error(`Failed to complete transfer ${transferId}`, error.stack);
```

### 8.5 Testing (Minimal for Sprint)

Cukup smoke test 1 happy path per controller di `*.spec.ts` (auto-generated by Nest CLI). **JANGAN** TDD strict di sprint mode. Bisa skip kalau time-constrained.

---

## 9. Environment & Setup

### `.env.example`
```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/sinergi_donor?schema=public"

# App
PORT=3000
NODE_ENV=development
API_PREFIX=api/v1

# CORS (untuk client.html)
CORS_ORIGIN=*
```

### Setup Commands (untuk AI assistant)
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database
npx prisma db seed

# Run dev server
npm run start:dev
# → http://localhost:3000
# → http://localhost:3000/docs (Swagger UI)
```

### `main.ts` Skeleton

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix + versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Global pipes/filters/interceptors
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // CORS
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? '*' });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Sinergi Donor — Inventory Service API')
    .setDescription('Single source of truth untuk stok darah lintas UDD dan BDRS')
    .setVersion('1.0')
    .addTag('Units')
    .addTag('Blood Bags')
    .addTag('Stock')
    .addTag('Stock Transfers')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

---

## 10. Common Pitfalls — AI Should Avoid

1. **Tidak validasi `unitId` exist** sebelum create blood bag. Always assert.
2. **Lupa transaction** saat multi-table write (terutama transfer). Gunakan `$transaction`.
3. **Hardcode shelf life** di multiple places. Centralize ke constant atau service method.
4. **Boilerplate response wrapping manual** di tiap controller. Pakai `ResponseInterceptor` global.
5. **N+1 queries** di endpoint list (loop + query inside). Pakai `include` atau second batch query.
6. **`Date` timezone issues**. Prisma store sebagai UTC. Selalu pakai `new Date()` (ISO). Hindari `moment.js` — pakai native `Date` atau `date-fns` kalau perlu.
7. **Decimal precision** untuk lat/lng. Jangan pake `number` raw di code, biarkan Prisma handle sebagai `Decimal`, convert ke `number` saat haversine: `Number(unit.latitude)`.
8. **Status update tanpa state machine check**. Always validate transition.
9. **Mengubah `code` Unit setelah created** — schema-level harusnya `@unique`, application-level reject di PATCH.
10. **Membuat Repository class terpisah** untuk Inventory Service. Cukup pakai PrismaService directly di Service layer. Repository pattern hanya overhead untuk MVP ini.

---

## 11. Out of Scope (Eksplisit untuk AI)

Hal-hal berikut **TIDAK perlu di-implement** di sprint ini. AI assistant: skip kalau diminta, suggest defer:

- ❌ Authentication & authorization (no JWT, no guards)
- ❌ Smart Dispatch Service (geospatial matching, courier dispatch)
- ❌ Donor Engagement Service (broadcast, gamifikasi)
- ❌ Identity & Validation Service (Dukcapil integration)
- ❌ Frontend UI (kecuali single `client.html`)
- ❌ Real-time WebSocket
- ❌ Redis pub/sub (design only, di Bab 3 dokumen)
- ❌ Legacy adapter ke sistem UDD/RS existing
- ❌ IoT cold chain monitoring
- ❌ Reporting/analytics dashboard
- ❌ Multi-tenancy
- ❌ i18n (semua message dalam Bahasa Indonesia + English mix sesuai context)
- ❌ Rate limiting (cukup default NestJS)
- ❌ Soft delete (kecuali `Unit.isActive`)
- ❌ Audit log (tidak ada `created_by` / `updated_by`)
- ❌ File upload (no photos, no documents)

---

## 12. Definition of Done (Per Endpoint)

Endpoint dianggap "done" jika:

- [ ] Controller + Service + DTO ada dan ter-import di Module
- [ ] Swagger decorators lengkap (`@ApiOperation`, `@ApiResponse`, `@ApiProperty` di DTO)
- [ ] class-validator decorators di semua field DTO
- [ ] Happy path manual-test via Swagger UI sukses
- [ ] Minimal 1 negative test (validation error) manual-test sukses
- [ ] Response sesuai envelope `{ success, data | error }`
- [ ] Business rule (kalau ada) implemented dan tested
- [ ] No unhandled promise rejection / TypeScript error

---

## 13. Project Deliverables Checklist (Sprint Final)

Untuk reference (bukan untuk AI execute, tapi context):

- [ ] GitHub repo public, README rapi
- [ ] Backend running locally + (opsional) deployed di Railway
- [ ] Swagger UI accessible di `/docs`
- [ ] Postman collection imported from Swagger, shared public link
- [ ] `client.html` single file di root, demonstrate semua endpoint
- [ ] Database schema migrated, seed data loaded
- [ ] Dokumen Word `Sinergi_Donor_Tugas_Akhir_ABL.docx` lengkap dengan 10 diagram C4
- [ ] Video presentasi 15 menit recorded & uploaded

---

## 14. Reference Files in Repo

Setelah project setup, file-file ini ada di repo dan bisa di-reference AI:

- `prisma/schema.prisma` — single source of truth schema
- `prisma/seed.ts` — sample data generator
- `src/main.ts` — bootstrap config
- `src/common/enums/*.ts` — enum definitions
- `client.html` — demo client (vanilla JS)
- `README.md` — setup instructions
- `CONTEXT.md` — **this file**

---

**Last updated:** Hari 0 sprint (sebelum mulai coding).
**Maintainer:** Muhammad Danish Alfattah Lubis + Farah Meytha Aisha.
**For AI assistant:** Selalu re-read file ini kalau ada ambiguity. Kalau ragu, tanya user. JANGAN assume di luar yang tertulis di sini.
