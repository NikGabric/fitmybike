-- CreateEnum
CREATE TYPE "BikeType" AS ENUM ('ROAD', 'TT', 'GRAVEL', 'MTB', 'OTHER');

-- CreateEnum
CREATE TYPE "FitStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FitStage" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "FitStep" AS ENUM ('BODY', 'BIKE_BEFORE', 'BIKE_AFTER', 'REVIEW');

-- CreateEnum
CREATE TYPE "MeasurementCategory" AS ENUM ('BODY', 'BIKE');

-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('MM', 'DECIDEGREE', 'GRAM');

-- CreateTable
CREATE TABLE "bikes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "sizeLabel" TEXT,
    "type" "BikeType" NOT NULL DEFAULT 'ROAD',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bikes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "MeasurementCategory" NOT NULL,
    "unit" "MeasurementUnit" NOT NULL,
    "minValue" INTEGER NOT NULL,
    "maxValue" INTEGER NOT NULL,
    "helpText" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "measurement_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bikeId" TEXT NOT NULL,
    "status" "FitStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" "FitStep" NOT NULL DEFAULT 'BODY',
    "reason" TEXT,
    "summary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "fits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fit_body_measurements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fitId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "note" TEXT,
    "prefilled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fit_body_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fit_bike_measurements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fitId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "stage" "FitStage" NOT NULL,
    "value" INTEGER NOT NULL,
    "note" TEXT,
    "prefilled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fit_bike_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bikes_organizationId_customerId_deletedAt_idx" ON "bikes"("organizationId", "customerId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_definitions_key_key" ON "measurement_definitions"("key");

-- CreateIndex
CREATE INDEX "measurement_definitions_category_sortOrder_idx" ON "measurement_definitions"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "fits_organizationId_customerId_deletedAt_idx" ON "fits"("organizationId", "customerId", "deletedAt");

-- CreateIndex
CREATE INDEX "fits_organizationId_bikeId_status_idx" ON "fits"("organizationId", "bikeId", "status");

-- CreateIndex
CREATE INDEX "fit_body_measurements_organizationId_fitId_idx" ON "fit_body_measurements"("organizationId", "fitId");

-- CreateIndex
CREATE UNIQUE INDEX "fit_body_measurements_fitId_definitionId_key" ON "fit_body_measurements"("fitId", "definitionId");

-- CreateIndex
CREATE INDEX "fit_bike_measurements_organizationId_fitId_idx" ON "fit_bike_measurements"("organizationId", "fitId");

-- CreateIndex
CREATE UNIQUE INDEX "fit_bike_measurements_fitId_definitionId_stage_key" ON "fit_bike_measurements"("fitId", "definitionId", "stage");

-- AddForeignKey
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fits" ADD CONSTRAINT "fits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fits" ADD CONSTRAINT "fits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fits" ADD CONSTRAINT "fits_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "bikes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fits" ADD CONSTRAINT "fits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_body_measurements" ADD CONSTRAINT "fit_body_measurements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_body_measurements" ADD CONSTRAINT "fit_body_measurements_fitId_fkey" FOREIGN KEY ("fitId") REFERENCES "fits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_body_measurements" ADD CONSTRAINT "fit_body_measurements_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "measurement_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_bike_measurements" ADD CONSTRAINT "fit_bike_measurements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_bike_measurements" ADD CONSTRAINT "fit_bike_measurements_fitId_fkey" FOREIGN KEY ("fitId") REFERENCES "fits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_bike_measurements" ADD CONSTRAINT "fit_bike_measurements_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "measurement_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
