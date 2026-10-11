-- AlterTable
ALTER TABLE "shop_aliases" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "role_field_permissions" (
    "role_id" TEXT NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "field" VARCHAR(100) NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "role_field_permissions_pkey" PRIMARY KEY ("role_id","module","field")
);

-- CreateIndex
CREATE INDEX "role_field_permissions_module_idx" ON "role_field_permissions"("module");

-- AddForeignKey
ALTER TABLE "role_field_permissions" ADD CONSTRAINT "role_field_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

