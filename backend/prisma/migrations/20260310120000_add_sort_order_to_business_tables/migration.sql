-- Add sort_order column to business tables for ordering functionality
-- This migration only adds columns, does not modify or delete any existing data

-- Roles
ALTER TABLE "roles" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Permissions
ALTER TABLE "permissions" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Folders
ALTER TABLE "folders" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Configs
ALTER TABLE "configs" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Dictionaries
ALTER TABLE "dictionaries" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Consumable Suppliers
ALTER TABLE "consumable_suppliers" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "consumable_suppliers_sort_order_idx" ON "consumable_suppliers"("sort_order");

-- Consumables
ALTER TABLE "consumables" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "consumables_sort_order_idx" ON "consumables"("sort_order");

-- Express Companies
ALTER TABLE "express_companies" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Finished Products
ALTER TABLE "finished_products" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "finished_products_sort_order_idx" ON "finished_products"("sort_order");

-- Labor Types
ALTER TABLE "labor_types" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "labor_types_sort_order_idx" ON "labor_types"("sort_order");

-- Product Links
ALTER TABLE "product_links" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "product_links_sort_order_idx" ON "product_links"("sort_order");

-- Products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "products_sort_order_idx" ON "products"("sort_order");

-- Profit Reports
ALTER TABLE "profit_reports" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Profit Report Entries
ALTER TABLE "profit_report_entries" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Profit Allocation Categories
ALTER TABLE "profit_allocation_categories" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Profit Allocation Items
ALTER TABLE "profit_allocation_items" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Profit Shipping Costs
ALTER TABLE "profit_shipping_costs" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Profit Store Expenses
ALTER TABLE "profit_store_expenses" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- SKUs
ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "skus_sort_order_idx" ON "skus"("sort_order");

-- Supplier Products
ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "supplier_products_sort_order_idx" ON "supplier_products"("sort_order");

-- Suppliers
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "suppliers_sort_order_idx" ON "suppliers"("sort_order");
