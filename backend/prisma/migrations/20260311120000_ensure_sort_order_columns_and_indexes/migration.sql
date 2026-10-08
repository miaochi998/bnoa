-- Remediation: ensure sort_order column and index exist on all business tables.
-- Idempotent (IF NOT EXISTS). Safe to run on production where the previous
-- migration may have failed or been partially applied. No data is modified.

-- Roles
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "roles_sort_order_idx" ON "roles"("sort_order");

-- Permissions
ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "permissions_sort_order_idx" ON "permissions"("sort_order");

-- Folders
ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "folders_sort_order_idx" ON "folders"("sort_order");

-- Configs
ALTER TABLE "configs" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "configs_sort_order_idx" ON "configs"("sort_order");

-- Dictionaries
ALTER TABLE "dictionaries" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "dictionaries_sort_order_idx" ON "dictionaries"("sort_order");

-- Consumable Suppliers
ALTER TABLE "consumable_suppliers" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "consumable_suppliers_sort_order_idx" ON "consumable_suppliers"("sort_order");

-- Consumables
ALTER TABLE "consumables" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "consumables_sort_order_idx" ON "consumables"("sort_order");

-- Express Companies
ALTER TABLE "express_companies" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "express_companies_sort_order_idx" ON "express_companies"("sort_order");

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
ALTER TABLE "profit_reports" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "profit_reports_sort_order_idx" ON "profit_reports"("sort_order");

-- Profit Report Entries
ALTER TABLE "profit_report_entries" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "profit_report_entries_sort_order_idx" ON "profit_report_entries"("sort_order");

-- Profit Allocation Categories
ALTER TABLE "profit_allocation_categories" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "profit_allocation_categories_sort_order_idx" ON "profit_allocation_categories"("sort_order");

-- Profit Allocation Items
ALTER TABLE "profit_allocation_items" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "profit_allocation_items_sort_order_idx" ON "profit_allocation_items"("sort_order");

-- Profit Shipping Costs
ALTER TABLE "profit_shipping_costs" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "profit_shipping_costs_sort_order_idx" ON "profit_shipping_costs"("sort_order");

-- Profit Store Expenses
ALTER TABLE "profit_store_expenses" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "profit_store_expenses_sort_order_idx" ON "profit_store_expenses"("sort_order");

-- SKUs
ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "skus_sort_order_idx" ON "skus"("sort_order");

-- Supplier Products
ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "supplier_products_sort_order_idx" ON "supplier_products"("sort_order");

-- Suppliers
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "suppliers_sort_order_idx" ON "suppliers"("sort_order");
