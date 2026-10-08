-- AlterTable
ALTER TABLE "express_companies" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "platforms" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "is_non_standard" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "skus" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "supplier_products" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "express_companies_deleted_at_idx" ON "express_companies"("deleted_at");

-- CreateIndex
CREATE INDEX "platforms_deleted_at_idx" ON "platforms"("deleted_at");

-- CreateIndex
CREATE INDEX "products_deleted_at_idx" ON "products"("deleted_at");

-- CreateIndex
CREATE INDEX "shops_deleted_at_idx" ON "shops"("deleted_at");

-- CreateIndex
CREATE INDEX "skus_deleted_at_idx" ON "skus"("deleted_at");

-- CreateIndex
CREATE INDEX "supplier_products_deleted_at_idx" ON "supplier_products"("deleted_at");

-- CreateIndex
CREATE INDEX "suppliers_deleted_at_idx" ON "suppliers"("deleted_at");
