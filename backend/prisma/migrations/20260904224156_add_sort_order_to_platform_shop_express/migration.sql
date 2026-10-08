-- AlterTable
ALTER TABLE "platforms" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "shops" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "express_companies" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "platforms_sort_order_idx" ON "platforms"("sort_order");
CREATE INDEX "shops_sort_order_idx" ON "shops"("sort_order");
CREATE INDEX "express_companies_sort_order_idx" ON "express_companies"("sort_order");
