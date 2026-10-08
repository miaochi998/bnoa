-- CreateEnum
CREATE TYPE "consumable_category" AS ENUM ('PACKAGING_BAG', 'EXPRESS_BAG', 'CARTON', 'TAPE', 'LABEL', 'OTHER');

-- CreateEnum
CREATE TYPE "consumable_status" AS ENUM ('ENABLED', 'DISABLED');

-- CreateTable
CREATE TABLE "consumable_suppliers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "contact" VARCHAR(100),
    "phone" VARCHAR(50),
    "status" "supplier_status" NOT NULL DEFAULT 'ACTIVE',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "consumable_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumables" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "category" "consumable_category" NOT NULL,
    "spec_desc" TEXT,
    "image" UUID,
    "status" "consumable_status" NOT NULL DEFAULT 'ENABLED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "consumables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_prices" (
    "id" UUID NOT NULL,
    "consumable_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "unit_price" DECIMAL(10,4) NOT NULL,
    "effect_date" TIMESTAMP(3) NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "batch_note" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "consumable_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consumable_suppliers_code_key" ON "consumable_suppliers"("code");

-- CreateIndex
CREATE INDEX "consumable_suppliers_status_idx" ON "consumable_suppliers"("status");

-- CreateIndex
CREATE INDEX "consumable_suppliers_deleted_at_idx" ON "consumable_suppliers"("deleted_at");

-- CreateIndex
CREATE INDEX "consumable_suppliers_created_at_idx" ON "consumable_suppliers"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "consumables_code_key" ON "consumables"("code");

-- CreateIndex
CREATE INDEX "consumables_category_idx" ON "consumables"("category");

-- CreateIndex
CREATE INDEX "consumables_status_idx" ON "consumables"("status");

-- CreateIndex
CREATE INDEX "consumables_deleted_at_idx" ON "consumables"("deleted_at");

-- CreateIndex
CREATE INDEX "consumables_created_at_idx" ON "consumables"("created_at");

-- CreateIndex
CREATE INDEX "consumable_prices_consumable_id_idx" ON "consumable_prices"("consumable_id");

-- CreateIndex
CREATE INDEX "consumable_prices_supplier_id_idx" ON "consumable_prices"("supplier_id");

-- CreateIndex
CREATE INDEX "consumable_prices_is_current_idx" ON "consumable_prices"("is_current");

-- AddForeignKey
ALTER TABLE "consumable_prices" ADD CONSTRAINT "consumable_prices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "consumable_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_prices" ADD CONSTRAINT "consumable_prices_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "consumables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
