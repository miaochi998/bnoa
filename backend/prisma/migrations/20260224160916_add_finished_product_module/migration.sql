-- CreateEnum
CREATE TYPE "finished_product_status" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "package_type" AS ENUM ('BAG', 'BOX', 'INDIVIDUAL');

-- CreateTable
CREATE TABLE "finished_products" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_product_id" UUID NOT NULL,
    "cut_length" DECIMAL(10,2),
    "cut_width" DECIMAL(10,2),
    "cut_height" DECIMAL(10,2),
    "package_type" "package_type" NOT NULL,
    "package_quantity" INTEGER NOT NULL,
    "package_unit" VARCHAR(20) NOT NULL,
    "weight" DECIMAL(10,4) NOT NULL,
    "material_cost" DECIMAL(10,4),
    "consumable_cost" DECIMAL(10,4),
    "labor_cost" DECIMAL(10,4),
    "total_cost" DECIMAL(10,4),
    "status" "finished_product_status" NOT NULL DEFAULT 'ENABLED',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "finished_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_product_consumables" (
    "id" UUID NOT NULL,
    "finished_product_id" UUID NOT NULL,
    "consumable_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "finished_product_consumables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_product_labor" (
    "id" UUID NOT NULL,
    "finished_product_id" UUID NOT NULL,
    "labor_type_id" UUID NOT NULL,

    CONSTRAINT "finished_product_labor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finished_products_code_key" ON "finished_products"("code");

-- CreateIndex
CREATE INDEX "finished_products_product_id_idx" ON "finished_products"("product_id");

-- CreateIndex
CREATE INDEX "finished_products_supplier_product_id_idx" ON "finished_products"("supplier_product_id");

-- CreateIndex
CREATE INDEX "finished_products_status_idx" ON "finished_products"("status");

-- CreateIndex
CREATE INDEX "finished_products_deleted_at_idx" ON "finished_products"("deleted_at");

-- CreateIndex
CREATE INDEX "finished_products_created_at_idx" ON "finished_products"("created_at");

-- CreateIndex
CREATE INDEX "finished_product_consumables_finished_product_id_idx" ON "finished_product_consumables"("finished_product_id");

-- CreateIndex
CREATE INDEX "finished_product_consumables_consumable_id_idx" ON "finished_product_consumables"("consumable_id");

-- CreateIndex
CREATE INDEX "finished_product_labor_finished_product_id_idx" ON "finished_product_labor"("finished_product_id");

-- CreateIndex
CREATE INDEX "finished_product_labor_labor_type_id_idx" ON "finished_product_labor"("labor_type_id");

-- AddForeignKey
ALTER TABLE "finished_products" ADD CONSTRAINT "finished_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_products" ADD CONSTRAINT "finished_products_supplier_product_id_fkey" FOREIGN KEY ("supplier_product_id") REFERENCES "supplier_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_product_consumables" ADD CONSTRAINT "finished_product_consumables_finished_product_id_fkey" FOREIGN KEY ("finished_product_id") REFERENCES "finished_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_product_consumables" ADD CONSTRAINT "finished_product_consumables_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "consumables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_product_labor" ADD CONSTRAINT "finished_product_labor_finished_product_id_fkey" FOREIGN KEY ("finished_product_id") REFERENCES "finished_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_product_labor" ADD CONSTRAINT "finished_product_labor_labor_type_id_fkey" FOREIGN KEY ("labor_type_id") REFERENCES "labor_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
