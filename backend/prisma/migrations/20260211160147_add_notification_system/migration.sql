-- CreateEnum
CREATE TYPE "notification_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "broadcast_status" AS ENUM ('PENDING', 'SENDING', 'SENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "broadcast_id" TEXT,
    "type" VARCHAR(50),
    "priority" "notification_priority" DEFAULT 'NORMAL',
    "title" VARCHAR(200),
    "content" TEXT,
    "related_type" VARCHAR(50),
    "related_id" TEXT,
    "action_url" VARCHAR(500),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_broadcasts" (
    "id" TEXT NOT NULL,
    "broadcast_no" VARCHAR(50) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "priority" "notification_priority" NOT NULL DEFAULT 'NORMAL',
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT,
    "action_url" VARCHAR(500),
    "target_type" VARCHAR(20) NOT NULL,
    "target_config" JSONB,
    "target_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "read_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "status" "broadcast_status" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notification_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_broadcast_id_idx" ON "notifications"("broadcast_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_deleted_at_idx" ON "notifications"("deleted_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_deleted_at_idx" ON "notifications"("user_id", "is_read", "deleted_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_deleted_at_idx" ON "notifications"("user_id", "created_at", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_broadcasts_broadcast_no_key" ON "notification_broadcasts"("broadcast_no");

-- CreateIndex
CREATE INDEX "notification_broadcasts_broadcast_no_idx" ON "notification_broadcasts"("broadcast_no");

-- CreateIndex
CREATE INDEX "notification_broadcasts_type_idx" ON "notification_broadcasts"("type");

-- CreateIndex
CREATE INDEX "notification_broadcasts_status_idx" ON "notification_broadcasts"("status");

-- CreateIndex
CREATE INDEX "notification_broadcasts_created_by_idx" ON "notification_broadcasts"("created_by");

-- CreateIndex
CREATE INDEX "notification_broadcasts_created_at_idx" ON "notification_broadcasts"("created_at");

-- CreateIndex
CREATE INDEX "notification_broadcasts_deleted_at_idx" ON "notification_broadcasts"("deleted_at");

-- CreateIndex
CREATE INDEX "notification_settings_user_id_idx" ON "notification_settings"("user_id");

-- CreateIndex
CREATE INDEX "notification_settings_type_idx" ON "notification_settings"("type");

-- CreateIndex
CREATE INDEX "notification_settings_user_id_enabled_idx" ON "notification_settings"("user_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_user_id_type_key" ON "notification_settings"("user_id", "type");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "notification_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
