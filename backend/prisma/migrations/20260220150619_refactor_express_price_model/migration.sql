/*
  Warnings:

  - You are about to drop the column `additional_weight` on the `express_prices` table. All the data in the column will be lost.
  - You are about to drop the column `additional_weight_price` on the `express_prices` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `express_prices` table. All the data in the column will be lost.
  - You are about to drop the column `first_weight` on the `express_prices` table. All the data in the column will be lost.
  - You are about to drop the column `first_weight_price` on the `express_prices` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `express_prices` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `express_prices` table. All the data in the column will be lost.
  - You are about to drop the column `volume_ratio` on the `express_prices` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[company_id,zone_id,weight_range_id]` on the table `express_prices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `price` to the `express_prices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weight_range_id` to the `express_prices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `zone_id` to the `express_prices` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "express_prices" DROP CONSTRAINT "express_prices_company_id_fkey";

-- DropIndex
DROP INDEX "express_prices_is_active_idx";

-- AlterTable
ALTER TABLE "express_prices" DROP COLUMN "additional_weight",
DROP COLUMN "additional_weight_price",
DROP COLUMN "created_by",
DROP COLUMN "first_weight",
DROP COLUMN "first_weight_price",
DROP COLUMN "is_active",
DROP COLUMN "updated_by",
DROP COLUMN "volume_ratio",
ADD COLUMN     "price" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "weight_range_id" UUID NOT NULL,
ADD COLUMN     "zone_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "express_zones" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "provinces" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "express_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "express_weight_ranges" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "min_weight" DECIMAL(10,2) NOT NULL,
    "max_weight" DECIMAL(10,2) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "express_weight_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "express_surcharges" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "provinces" TEXT[],
    "weight_from" DECIMAL(10,2),
    "weight_to" DECIMAL(10,2),
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "express_surcharges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "express_zones_company_id_idx" ON "express_zones"("company_id");

-- CreateIndex
CREATE INDEX "express_weight_ranges_company_id_idx" ON "express_weight_ranges"("company_id");

-- CreateIndex
CREATE INDEX "express_surcharges_company_id_idx" ON "express_surcharges"("company_id");

-- CreateIndex
CREATE INDEX "express_prices_zone_id_idx" ON "express_prices"("zone_id");

-- CreateIndex
CREATE INDEX "express_prices_weight_range_id_idx" ON "express_prices"("weight_range_id");

-- CreateIndex
CREATE UNIQUE INDEX "express_prices_company_id_zone_id_weight_range_id_key" ON "express_prices"("company_id", "zone_id", "weight_range_id");

-- AddForeignKey
ALTER TABLE "express_zones" ADD CONSTRAINT "express_zones_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "express_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "express_weight_ranges" ADD CONSTRAINT "express_weight_ranges_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "express_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "express_prices" ADD CONSTRAINT "express_prices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "express_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "express_prices" ADD CONSTRAINT "express_prices_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "express_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "express_prices" ADD CONSTRAINT "express_prices_weight_range_id_fkey" FOREIGN KEY ("weight_range_id") REFERENCES "express_weight_ranges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "express_surcharges" ADD CONSTRAINT "express_surcharges_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "express_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
