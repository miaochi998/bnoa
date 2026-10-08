-- CreateEnum
CREATE TYPE "product_link_status" AS ENUM ('DRAFT', 'ON_SALE', 'OFF_SALE');

-- CreateTable
CREATE TABLE "product_links" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "shop_id" UUID NOT NULL,
    "platform_url" TEXT,
    "platform_item_id" VARCHAR(100),
    "status" "product_link_status" NOT NULL DEFAULT 'DRAFT',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "product_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_links_shop_id_idx" ON "product_links"("shop_id");

-- CreateIndex
CREATE INDEX "product_links_status_idx" ON "product_links"("status");

-- CreateIndex
CREATE INDEX "product_links_deleted_at_idx" ON "product_links"("deleted_at");

-- CreateIndex
CREATE INDEX "product_links_created_at_idx" ON "product_links"("created_at");

-- AddForeignKey
ALTER TABLE "product_links" ADD CONSTRAINT "product_links_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
