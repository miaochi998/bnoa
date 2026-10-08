-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "price_unit" ADD VALUE 'PER_SQUARE_METER';
ALTER TYPE "price_unit" ADD VALUE 'PER_METER';
ALTER TYPE "price_unit" ADD VALUE 'PER_GRAM';
ALTER TYPE "price_unit" ADD VALUE 'PER_BOTTLE';
ALTER TYPE "price_unit" ADD VALUE 'PER_BOX';
ALTER TYPE "price_unit" ADD VALUE 'PER_CAN';
ALTER TYPE "price_unit" ADD VALUE 'PER_CASE';
ALTER TYPE "price_unit" ADD VALUE 'PER_STRIP';
ALTER TYPE "price_unit" ADD VALUE 'PER_SET';
ALTER TYPE "price_unit" ADD VALUE 'PER_ROLL';
ALTER TYPE "price_unit" ADD VALUE 'PER_BAG';
ALTER TYPE "price_unit" ADD VALUE 'PER_SHEET';
ALTER TYPE "price_unit" ADD VALUE 'PER_PAIR';
ALTER TYPE "price_unit" ADD VALUE 'PER_CUSTOM';

-- AlterTable
ALTER TABLE "supplier_products" ADD COLUMN     "price_unit_custom" VARCHAR(50);
