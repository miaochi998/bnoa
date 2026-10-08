-- CreateEnum
CREATE TYPE "payment_currency" AS ENUM ('CNY', 'USD', 'EUR', 'OTHER');

-- CreateEnum
CREATE TYPE "payment_type" AS ENUM ('GOODS', 'FREIGHT', 'CONSUMABLE', 'PROMOTION', 'SERVICE', 'REFUND', 'OTHER');

-- CreateEnum
CREATE TYPE "receiver_type" AS ENUM ('SUPPLIER', 'CONSUMABLE_SUPPLIER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "pay_method" AS ENUM ('CORPORATE_TRANSFER', 'PERSONAL_TRANSFER', 'CASH', 'ACCEPTANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('PENDING', 'ISSUED', 'NOT_REQUIRED', 'VOID');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('DRAFT', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_attachment_type" AS ENUM ('SCREENSHOT', 'INVOICE');


-- CreateTable
CREATE TABLE "payment_records" (
    "id" UUID NOT NULL,
    "record_no" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "payment_currency" NOT NULL DEFAULT 'CNY',
    "payment_time" TIMESTAMP(3) NOT NULL,
    "payment_type" "payment_type" NOT NULL,
    "receiver_type" "receiver_type" NOT NULL,
    "receiver_name" VARCHAR(200),
    "supplier_id" UUID,
    "consumable_supplier_id" UUID,
    "custom_receiver_name" VARCHAR(200),
    "pay_method" "pay_method" NOT NULL,
    "from_account" VARCHAR(200),
    "invoice_status" "invoice_status" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'DRAFT',
    "payer_id" TEXT NOT NULL,
    "remark" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_bills" (
    "id" UUID NOT NULL,
    "payment_record_id" UUID NOT NULL,
    "bill_number" VARCHAR(100) NOT NULL,
    "bill_date" TIMESTAMP(3),
    "bill_amount" DECIMAL(12,2),
    "bill_file_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attachments" (
    "id" UUID NOT NULL,
    "payment_record_id" UUID NOT NULL,
    "type" "payment_attachment_type" NOT NULL,
    "file_id" TEXT NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_records_record_no_key" ON "payment_records"("record_no");

-- CreateIndex
CREATE INDEX "payment_records_payment_time_idx" ON "payment_records"("payment_time");

-- CreateIndex
CREATE INDEX "payment_records_payment_type_idx" ON "payment_records"("payment_type");

-- CreateIndex
CREATE INDEX "payment_records_receiver_type_idx" ON "payment_records"("receiver_type");

-- CreateIndex
CREATE INDEX "payment_records_supplier_id_idx" ON "payment_records"("supplier_id");

-- CreateIndex
CREATE INDEX "payment_records_consumable_supplier_id_idx" ON "payment_records"("consumable_supplier_id");

-- CreateIndex
CREATE INDEX "payment_records_payer_id_idx" ON "payment_records"("payer_id");

-- CreateIndex
CREATE INDEX "payment_records_status_idx" ON "payment_records"("status");

-- CreateIndex
CREATE INDEX "payment_records_deleted_at_idx" ON "payment_records"("deleted_at");

-- CreateIndex
CREATE INDEX "payment_records_created_at_idx" ON "payment_records"("created_at");

-- CreateIndex
CREATE INDEX "payment_bills_payment_record_id_idx" ON "payment_bills"("payment_record_id");

-- CreateIndex
CREATE INDEX "payment_bills_bill_file_id_idx" ON "payment_bills"("bill_file_id");

-- CreateIndex
CREATE INDEX "payment_attachments_payment_record_id_idx" ON "payment_attachments"("payment_record_id");

-- CreateIndex
CREATE INDEX "payment_attachments_file_id_idx" ON "payment_attachments"("file_id");

-- CreateIndex
CREATE INDEX "payment_attachments_type_idx" ON "payment_attachments"("type");

-- AddForeignKey
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_consumable_supplier_id_fkey" FOREIGN KEY ("consumable_supplier_id") REFERENCES "consumable_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_bills" ADD CONSTRAINT "payment_bills_payment_record_id_fkey" FOREIGN KEY ("payment_record_id") REFERENCES "payment_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_bills" ADD CONSTRAINT "payment_bills_bill_file_id_fkey" FOREIGN KEY ("bill_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attachments" ADD CONSTRAINT "payment_attachments_payment_record_id_fkey" FOREIGN KEY ("payment_record_id") REFERENCES "payment_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attachments" ADD CONSTRAINT "payment_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

