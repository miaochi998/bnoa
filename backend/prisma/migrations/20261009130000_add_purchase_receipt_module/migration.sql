-- CreateEnum
CREATE TYPE "purchase_item_type" AS ENUM ('PRODUCT', 'CONSUMABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "purchase_image_type" AS ENUM ('BILL', 'GOODS');

-- CreateEnum
CREATE TYPE "purchase_bill_no_source" AS ENUM ('AI', 'MANUAL', 'AUTO_NO_PAPER', 'NONE');

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" UUID NOT NULL,
    "receipt_no" VARCHAR(50) NOT NULL,
    "receipt_time" TIMESTAMP(3) NOT NULL,
    "bill_no" VARCHAR(100),
    "bill_no_source" "purchase_bill_no_source" NOT NULL DEFAULT 'NONE',
    "bill_amount" DECIMAL(14,2),
    "is_accurate" BOOLEAN NOT NULL DEFAULT true,
    "remark" TEXT,
    "checker_id" TEXT NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_items" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "item_type" "purchase_item_type" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "product_id" UUID,
    "supplier_id" UUID,
    "supplier_product_id" UUID,
    "consumable_id" UUID,
    "consumable_supplier_id" UUID,
    "item_name" VARCHAR(200) NOT NULL,
    "supplier_name" VARCHAR(200),
    "spec_name" VARCHAR(200),
    "quantity_text" VARCHAR(200) NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_images" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "item_id" UUID,
    "file_id" TEXT NOT NULL,
    "type" "purchase_image_type" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipt_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_record_purchase_receipts" (
    "payment_record_id" UUID NOT NULL,
    "purchase_receipt_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "payment_record_purchase_receipts_pkey" PRIMARY KEY ("payment_record_id","purchase_receipt_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipts_receipt_no_key" ON "purchase_receipts"("receipt_no");

-- CreateIndex
CREATE INDEX "purchase_receipts_receipt_time_idx" ON "purchase_receipts"("receipt_time");

-- CreateIndex
CREATE INDEX "purchase_receipts_bill_no_idx" ON "purchase_receipts"("bill_no");

-- CreateIndex
CREATE INDEX "purchase_receipts_checker_id_idx" ON "purchase_receipts"("checker_id");

-- CreateIndex
CREATE INDEX "purchase_receipts_created_by_idx" ON "purchase_receipts"("created_by");

-- CreateIndex
CREATE INDEX "purchase_receipts_deleted_at_idx" ON "purchase_receipts"("deleted_at");

-- CreateIndex
CREATE INDEX "purchase_receipts_created_at_idx" ON "purchase_receipts"("created_at");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_receipt_id_idx" ON "purchase_receipt_items"("receipt_id");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_product_id_idx" ON "purchase_receipt_items"("product_id");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_supplier_id_idx" ON "purchase_receipt_items"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_consumable_id_idx" ON "purchase_receipt_items"("consumable_id");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_consumable_supplier_id_idx" ON "purchase_receipt_items"("consumable_supplier_id");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_item_type_idx" ON "purchase_receipt_items"("item_type");

-- CreateIndex
CREATE INDEX "purchase_receipt_images_receipt_id_idx" ON "purchase_receipt_images"("receipt_id");

-- CreateIndex
CREATE INDEX "purchase_receipt_images_item_id_idx" ON "purchase_receipt_images"("item_id");

-- CreateIndex
CREATE INDEX "purchase_receipt_images_file_id_idx" ON "purchase_receipt_images"("file_id");

-- CreateIndex
CREATE INDEX "purchase_receipt_images_type_idx" ON "purchase_receipt_images"("type");

-- CreateIndex
CREATE INDEX "payment_record_purchase_receipts_purchase_receipt_id_idx" ON "payment_record_purchase_receipts"("purchase_receipt_id");

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_checker_id_fkey" FOREIGN KEY ("checker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_supplier_product_id_fkey" FOREIGN KEY ("supplier_product_id") REFERENCES "supplier_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "consumables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_consumable_supplier_id_fkey" FOREIGN KEY ("consumable_supplier_id") REFERENCES "consumable_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_images" ADD CONSTRAINT "purchase_receipt_images_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_images" ADD CONSTRAINT "purchase_receipt_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "purchase_receipt_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_images" ADD CONSTRAINT "purchase_receipt_images_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record_purchase_receipts" ADD CONSTRAINT "payment_record_purchase_receipts_payment_record_id_fkey" FOREIGN KEY ("payment_record_id") REFERENCES "payment_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record_purchase_receipts" ADD CONSTRAINT "payment_record_purchase_receipts_purchase_receipt_id_fkey" FOREIGN KEY ("purchase_receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
