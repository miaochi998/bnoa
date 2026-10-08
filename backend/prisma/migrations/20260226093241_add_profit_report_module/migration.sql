-- CreateEnum
CREATE TYPE "profit_report_status" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateTable
CREATE TABLE "profit_reports" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "profit_report_status" NOT NULL DEFAULT 'DRAFT',
    "remark" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "profit_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_report_entries" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "sales_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "raw_material_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "packaging_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "labor_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_report_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_shipping_costs" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "express_company_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_shipping_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_store_expenses" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_store_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_allocation_categories" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_allocation_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_allocation_items" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_allocation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_company_expenses" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_allocatable" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_company_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_non_expenses" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_non_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profit_reports_year_idx" ON "profit_reports"("year");

-- CreateIndex
CREATE INDEX "profit_reports_status_idx" ON "profit_reports"("status");

-- CreateIndex
CREATE INDEX "profit_reports_deleted_at_idx" ON "profit_reports"("deleted_at");

-- CreateIndex
CREATE INDEX "profit_reports_created_at_idx" ON "profit_reports"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "profit_reports_year_month_deleted_at_key" ON "profit_reports"("year", "month", "deleted_at");

-- CreateIndex
CREATE INDEX "profit_report_entries_report_id_idx" ON "profit_report_entries"("report_id");

-- CreateIndex
CREATE INDEX "profit_report_entries_shop_id_idx" ON "profit_report_entries"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "profit_report_entries_report_id_shop_id_key" ON "profit_report_entries"("report_id", "shop_id");

-- CreateIndex
CREATE INDEX "profit_shipping_costs_entry_id_idx" ON "profit_shipping_costs"("entry_id");

-- CreateIndex
CREATE INDEX "profit_shipping_costs_express_company_id_idx" ON "profit_shipping_costs"("express_company_id");

-- CreateIndex
CREATE INDEX "profit_store_expenses_entry_id_idx" ON "profit_store_expenses"("entry_id");

-- CreateIndex
CREATE INDEX "profit_allocation_categories_report_id_idx" ON "profit_allocation_categories"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "profit_allocation_categories_report_id_name_key" ON "profit_allocation_categories"("report_id", "name");

-- CreateIndex
CREATE INDEX "profit_allocation_items_entry_id_idx" ON "profit_allocation_items"("entry_id");

-- CreateIndex
CREATE INDEX "profit_allocation_items_category_id_idx" ON "profit_allocation_items"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "profit_allocation_items_entry_id_category_id_key" ON "profit_allocation_items"("entry_id", "category_id");

-- CreateIndex
CREATE INDEX "profit_company_expenses_report_id_idx" ON "profit_company_expenses"("report_id");

-- CreateIndex
CREATE INDEX "profit_non_expenses_report_id_idx" ON "profit_non_expenses"("report_id");

-- AddForeignKey
ALTER TABLE "profit_reports" ADD CONSTRAINT "profit_reports_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_report_entries" ADD CONSTRAINT "profit_report_entries_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "profit_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_report_entries" ADD CONSTRAINT "profit_report_entries_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_shipping_costs" ADD CONSTRAINT "profit_shipping_costs_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "profit_report_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_shipping_costs" ADD CONSTRAINT "profit_shipping_costs_express_company_id_fkey" FOREIGN KEY ("express_company_id") REFERENCES "express_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_store_expenses" ADD CONSTRAINT "profit_store_expenses_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "profit_report_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_allocation_categories" ADD CONSTRAINT "profit_allocation_categories_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "profit_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_allocation_items" ADD CONSTRAINT "profit_allocation_items_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "profit_report_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_allocation_items" ADD CONSTRAINT "profit_allocation_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "profit_allocation_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_company_expenses" ADD CONSTRAINT "profit_company_expenses_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "profit_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_non_expenses" ADD CONSTRAINT "profit_non_expenses_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "profit_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
