-- 付款记录：3 个枚举类型名加 payment_ 前缀隔离（纯 RENAME，不重建列、不丢数据）
ALTER TYPE "receiver_type" RENAME TO "payment_receiver_type";
ALTER TYPE "pay_method" RENAME TO "payment_pay_method";
ALTER TYPE "invoice_status" RENAME TO "payment_invoice_status";
