/*
  Warnings:

  - You are about to drop the column `code` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `length` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `platform_price` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `platform_product_id` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `platform_url` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `product_id` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `shop_id` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `supplier_id` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `supply_price` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `skus` table. All the data in the column will be lost.
  - Added the required column `link_id` to the `skus` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "sku_type" AS ENUM ('SINGLE', 'COMBO');

-- DropForeignKey
ALTER TABLE "skus" DROP CONSTRAINT "skus_product_id_fkey";

-- DropForeignKey
ALTER TABLE "skus" DROP CONSTRAINT "skus_shop_id_fkey";

-- DropForeignKey
ALTER TABLE "skus" DROP CONSTRAINT "skus_supplier_id_fkey";

-- DropIndex
DROP INDEX "skus_default_express_company_id_idx";

-- DropIndex
DROP INDEX "skus_product_id_idx";

-- DropIndex
DROP INDEX "skus_shop_id_code_key";

-- DropIndex
DROP INDEX "skus_shop_id_idx";

-- DropIndex
DROP INDEX "skus_supplier_id_idx";

-- AlterTable
ALTER TABLE "skus" DROP COLUMN "code",
DROP COLUMN "description",
DROP COLUMN "height",
DROP COLUMN "length",
DROP COLUMN "platform_price",
DROP COLUMN "platform_product_id",
DROP COLUMN "platform_url",
DROP COLUMN "product_id",
DROP COLUMN "shop_id",
DROP COLUMN "supplier_id",
DROP COLUMN "supply_price",
DROP COLUMN "width",
ADD COLUMN     "combo_package_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "express_cost" DECIMAL(10,4),
ADD COLUMN     "link_id" UUID NOT NULL,
ADD COLUMN     "misc_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "product_cost" DECIMAL(10,4),
ADD COLUMN     "total_cost" DECIMAL(10,4),
ADD COLUMN     "type" "sku_type" NOT NULL DEFAULT 'SINGLE';

-- CreateTable
CREATE TABLE "sku_finished_products" (
    "id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "finished_product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sku_finished_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sku_finished_products_sku_id_idx" ON "sku_finished_products"("sku_id");

-- CreateIndex
CREATE INDEX "sku_finished_products_finished_product_id_idx" ON "sku_finished_products"("finished_product_id");

-- CreateIndex
CREATE INDEX "skus_link_id_idx" ON "skus"("link_id");

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "product_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_finished_products" ADD CONSTRAINT "sku_finished_products_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_finished_products" ADD CONSTRAINT "sku_finished_products_finished_product_id_fkey" FOREIGN KEY ("finished_product_id") REFERENCES "finished_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
