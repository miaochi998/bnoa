/*
  Warnings:

  - You are about to alter the column `supply_price` on the `supplier_products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - A unique constraint covering the columns `[supplier_id,product_id,style_name]` on the table `supplier_products` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "price_unit" AS ENUM ('PER_CUBIC_METER', 'PER_KG', 'PER_PIECE', 'PER_LITER', 'PER_ML');

-- DropIndex
DROP INDEX "supplier_products_supplier_id_product_id_key";

-- AlterTable
ALTER TABLE "supplier_products" ADD COLUMN     "price_unit" "price_unit" NOT NULL DEFAULT 'PER_PIECE',
ADD COLUMN     "style_name" VARCHAR(100),
ADD COLUMN     "style_params" JSONB,
ALTER COLUMN "supply_price" SET DATA TYPE DECIMAL(10,4);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_products_supplier_id_product_id_style_name_key" ON "supplier_products"("supplier_id", "product_id", "style_name");
