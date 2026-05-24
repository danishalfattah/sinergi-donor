-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('UDD', 'BDRS');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('WHOLE_BLOOD', 'PRC', 'TC', 'FFP');

-- CreateEnum
CREATE TYPE "BloodBagStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'IN_TRANSIT', 'USED', 'EXPIRED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferReason" AS ENUM ('CRITICAL_REQUEST', 'FEFO_REBALANCE', 'MANUAL');

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "criticalThreshold" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_bags" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "component" "ComponentType" NOT NULL,
    "volumeMl" INTEGER NOT NULL,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" "BloodBagStatus" NOT NULL DEFAULT 'AVAILABLE',
    "unitId" TEXT NOT NULL,
    "donorId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transferId" TEXT,

    CONSTRAINT "blood_bags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "transferCode" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "reason" "TransferReason" NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "initiatedBy" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_code_key" ON "units"("code");

-- CreateIndex
CREATE INDEX "units_type_idx" ON "units"("type");

-- CreateIndex
CREATE INDEX "units_city_province_idx" ON "units"("city", "province");

-- CreateIndex
CREATE UNIQUE INDEX "blood_bags_serialNumber_key" ON "blood_bags"("serialNumber");

-- CreateIndex
CREATE INDEX "blood_bags_unitId_status_idx" ON "blood_bags"("unitId", "status");

-- CreateIndex
CREATE INDEX "blood_bags_bloodType_status_idx" ON "blood_bags"("bloodType", "status");

-- CreateIndex
CREATE INDEX "blood_bags_expiryDate_idx" ON "blood_bags"("expiryDate");

-- CreateIndex
CREATE INDEX "blood_bags_status_expiryDate_idx" ON "blood_bags"("status", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_transferCode_key" ON "stock_transfers"("transferCode");

-- CreateIndex
CREATE INDEX "stock_transfers_fromUnitId_status_idx" ON "stock_transfers"("fromUnitId", "status");

-- CreateIndex
CREATE INDEX "stock_transfers_toUnitId_status_idx" ON "stock_transfers"("toUnitId", "status");

-- CreateIndex
CREATE INDEX "stock_transfers_status_initiatedAt_idx" ON "stock_transfers"("status", "initiatedAt");

-- AddForeignKey
ALTER TABLE "blood_bags" ADD CONSTRAINT "blood_bags_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_bags" ADD CONSTRAINT "blood_bags_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
