-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "file_access" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'VIEW', 'SECURITY_UPLOAD_BLOCKED', 'SECURITY_VIRUS_DETECTED', 'SECURITY_FILE_QUARANTINED', 'SECURITY_DISK_SPACE_LOW', 'SECURITY_LIMIT_EXCEEDED', 'SECURITY_SECURITY_VIOLATION', 'SECURITY_FILE_ISOLATED', 'SECURITY_FILE_RELEASED');

-- CreateEnum
CREATE TYPE "storage_type" AS ENUM ('RUSTFS', 'LOCAL', 'S3');

-- CreateEnum
CREATE TYPE "upload_status" AS ENUM ('PENDING', 'UPLOADING', 'PAUSED', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "file_category" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'ARCHIVE', 'CODE', 'OTHER');

-- CreateEnum
CREATE TYPE "folder_share_type" AS ENUM ('NONE', 'SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "share_permission" AS ENUM ('VIEW', 'DOWNLOAD', 'UPLOAD', 'EDIT', 'DELETE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "avatar" VARCHAR(500),
    "description" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" VARCHAR(50),
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "icon" VARCHAR(100),
    "path" VARCHAR(255),
    "component" VARCHAR(255),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "keep_alive" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "data_scope" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "extension" VARCHAR(20) NOT NULL,
    "size" INTEGER NOT NULL,
    "md5" VARCHAR(32),
    "storage_type" "storage_type" NOT NULL DEFAULT 'RUSTFS',
    "bucket" VARCHAR(100) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "thumbnail_url" VARCHAR(500),
    "access" "file_access" NOT NULL DEFAULT 'PRIVATE',
    "share_code" VARCHAR(32),
    "share_expire_at" TIMESTAMP(3),
    "status" VARCHAR(20) DEFAULT 'ACTIVE',
    "quarantined_at" TIMESTAMP(3),
    "quarantine_reason" VARCHAR(500),
    "quarantine_path" VARCHAR(500),
    "virus_scan_result" VARCHAR(100),
    "virus_scan_at" TIMESTAMP(3),
    "folder_id" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "parent_id" TEXT,
    "real_folder_id" TEXT,
    "is_virtual" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "share_type" "folder_share_type" NOT NULL DEFAULT 'NONE',
    "is_system_shared" BOOLEAN NOT NULL DEFAULT false,
    "access" "file_access" NOT NULL DEFAULT 'PRIVATE',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_shares" (
    "id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "shared_with_user_id" TEXT,
    "shared_with_role_id" TEXT,
    "permissions" "share_permission"[] DEFAULT ARRAY['VIEW', 'DOWNLOAD']::"share_permission"[],
    "shared_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folder_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configs" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "category" VARCHAR(50) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionaries" (
    "id" TEXT NOT NULL,
    "type_code" VARCHAR(50) NOT NULL,
    "type_name" VARCHAR(100) NOT NULL,
    "item_code" VARCHAR(50) NOT NULL,
    "item_name" VARCHAR(100) NOT NULL,
    "item_value" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(255),
    "color" VARCHAR(20),
    "icon" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dictionaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "audit_action" NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "resource_id" VARCHAR(100),
    "description" VARCHAR(500),
    "old_value" TEXT,
    "new_value" TEXT,
    "diff" TEXT,
    "user_id" TEXT,
    "username" VARCHAR(100),
    "real_name" VARCHAR(100),
    "ip" VARCHAR(50) NOT NULL,
    "user_agent" TEXT,
    "request_url" VARCHAR(500) NOT NULL,
    "request_method" VARCHAR(10) NOT NULL,
    "request_params" TEXT,
    "execution_time" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" VARCHAR(100),
    "device_name" VARCHAR(100),
    "ip" VARCHAR(50),
    "user_agent" TEXT,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "file_md5" VARCHAR(32) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "extension" VARCHAR(20) NOT NULL,
    "chunk_size" INTEGER NOT NULL DEFAULT 5242880,
    "chunk_count" INTEGER NOT NULL,
    "uploaded_chunks" INTEGER NOT NULL DEFAULT 0,
    "chunks" JSONB,
    "storage_type" "storage_type" NOT NULL DEFAULT 'RUSTFS',
    "bucket" VARCHAR(100) NOT NULL,
    "file_key" VARCHAR(500),
    "status" "upload_status" NOT NULL DEFAULT 'PENDING',
    "folder_id" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_format_configs" (
    "id" TEXT NOT NULL,
    "extension" VARCHAR(20) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "mime_types" JSONB NOT NULL,
    "min_size" BIGINT NOT NULL DEFAULT 0,
    "max_size" BIGINT NOT NULL,
    "category" "file_category",
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_format_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "real_folders" (
    "id" TEXT NOT NULL,
    "path_name" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "upload_role_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "download_role_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_upload_public" BOOLEAN NOT NULL DEFAULT false,
    "is_download_public" BOOLEAN NOT NULL DEFAULT true,
    "file_count" INTEGER NOT NULL DEFAULT 0,
    "total_size" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "real_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_folders" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "parent_id" TEXT,
    "real_folder_id" TEXT NOT NULL,
    "file_count" INTEGER NOT NULL DEFAULT 0,
    "total_size" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "virtual_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "extension" VARCHAR(20) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "file_md5" VARCHAR(32),
    "file_sha256" VARCHAR(64),
    "storage_type" "storage_type" NOT NULL DEFAULT 'RUSTFS',
    "bucket" VARCHAR(100),
    "file_path" VARCHAR(500) NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "thumbnail_url" VARCHAR(500),
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "category" "file_category" NOT NULL DEFAULT 'OTHER',
    "virtual_folder_id" TEXT,
    "real_folder_id" TEXT,
    "processed_status" VARCHAR(20),
    "scan_status" VARCHAR(20),
    "scan_result" JSONB,
    "scanned_at" TIMESTAMP(3),
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "media_file_id" TEXT,
    "action" VARCHAR(50) NOT NULL,
    "file_name" VARCHAR(255),
    "file_size" BIGINT,
    "file_extension" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL,
    "error_message" TEXT,
    "metadata" JSONB,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recycle_bin" (
    "id" TEXT NOT NULL,
    "original_id" TEXT NOT NULL,
    "original_type" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "size" BIGINT,
    "deleted_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purge_at" TIMESTAMP(3) NOT NULL,
    "restored_at" TIMESTAMP(3),
    "restored_by" TEXT,

    CONSTRAINT "recycle_bin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "group" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_logs" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'INFO',
    "status" VARCHAR(20) NOT NULL DEFAULT 'NEW',
    "user_id" TEXT,
    "file_id" TEXT,
    "file_name" VARCHAR(255),
    "details" TEXT,
    "metadata" JSONB,
    "ip_address" VARCHAR(50),
    "location" VARCHAR(100),
    "action_taken" TEXT,
    "notes" TEXT,
    "acknowledged_by" VARCHAR(100),
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_security_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enable_format_limit" BOOLEAN NOT NULL DEFAULT true,
    "enable_size_limit" BOOLEAN NOT NULL DEFAULT true,
    "global_max_size" BIGINT NOT NULL DEFAULT 1073741824,
    "global_max_files" INTEGER NOT NULL DEFAULT 100,
    "dangerous_extensions" TEXT[] DEFAULT ARRAY['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js']::TEXT[],
    "enable_virus_scan" BOOLEAN NOT NULL DEFAULT true,
    "scan_timeout_seconds" INTEGER NOT NULL DEFAULT 300,
    "auto_quarantine" BOOLEAN NOT NULL DEFAULT true,
    "enable_space_check" BOOLEAN NOT NULL DEFAULT true,
    "min_free_space_bytes" BIGINT NOT NULL DEFAULT 1073741824,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "upload_security_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_code_idx" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_is_active_idx" ON "roles"("is_active");

-- CreateIndex
CREATE INDEX "roles_deleted_at_idx" ON "roles"("deleted_at");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_code_idx" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_type_idx" ON "permissions"("type");

-- CreateIndex
CREATE INDEX "permissions_parent_id_idx" ON "permissions"("parent_id");

-- CreateIndex
CREATE INDEX "permissions_is_active_idx" ON "permissions"("is_active");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_share_code_key" ON "files"("share_code");

-- CreateIndex
CREATE INDEX "files_folder_id_idx" ON "files"("folder_id");

-- CreateIndex
CREATE INDEX "files_uploaded_by_idx" ON "files"("uploaded_by");

-- CreateIndex
CREATE INDEX "files_access_idx" ON "files"("access");

-- CreateIndex
CREATE INDEX "files_share_code_idx" ON "files"("share_code");

-- CreateIndex
CREATE INDEX "files_deleted_at_idx" ON "files"("deleted_at");

-- CreateIndex
CREATE INDEX "files_created_at_idx" ON "files"("created_at");

-- CreateIndex
CREATE INDEX "folders_parent_id_idx" ON "folders"("parent_id");

-- CreateIndex
CREATE INDEX "folders_created_by_idx" ON "folders"("created_by");

-- CreateIndex
CREATE INDEX "folders_access_idx" ON "folders"("access");

-- CreateIndex
CREATE INDEX "folders_deleted_at_idx" ON "folders"("deleted_at");

-- CreateIndex
CREATE INDEX "folders_real_folder_id_idx" ON "folders"("real_folder_id");

-- CreateIndex
CREATE INDEX "folders_share_type_idx" ON "folders"("share_type");

-- CreateIndex
CREATE INDEX "folder_shares_folder_id_idx" ON "folder_shares"("folder_id");

-- CreateIndex
CREATE INDEX "folder_shares_shared_with_user_id_idx" ON "folder_shares"("shared_with_user_id");

-- CreateIndex
CREATE INDEX "folder_shares_shared_with_role_id_idx" ON "folder_shares"("shared_with_role_id");

-- CreateIndex
CREATE INDEX "folder_shares_shared_by_idx" ON "folder_shares"("shared_by");

-- CreateIndex
CREATE UNIQUE INDEX "folder_shares_folder_id_shared_with_user_id_key" ON "folder_shares"("folder_id", "shared_with_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "folder_shares_folder_id_shared_with_role_id_key" ON "folder_shares"("folder_id", "shared_with_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "configs_key_key" ON "configs"("key");

-- CreateIndex
CREATE INDEX "configs_category_idx" ON "configs"("category");

-- CreateIndex
CREATE INDEX "configs_is_active_idx" ON "configs"("is_active");

-- CreateIndex
CREATE INDEX "configs_deleted_at_idx" ON "configs"("deleted_at");

-- CreateIndex
CREATE INDEX "dictionaries_type_code_idx" ON "dictionaries"("type_code");

-- CreateIndex
CREATE INDEX "dictionaries_is_active_idx" ON "dictionaries"("is_active");

-- CreateIndex
CREATE INDEX "dictionaries_deleted_at_idx" ON "dictionaries"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "dictionaries_type_code_item_code_key" ON "dictionaries"("type_code", "item_code");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_module_idx" ON "audit_logs"("module");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_resource_id_idx" ON "audit_logs"("resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_status_idx" ON "audit_logs"("status");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_device_id_idx" ON "refresh_tokens"("device_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_is_revoked_idx" ON "refresh_tokens"("is_revoked");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "upload_sessions_file_md5_idx" ON "upload_sessions"("file_md5");

-- CreateIndex
CREATE INDEX "upload_sessions_status_idx" ON "upload_sessions"("status");

-- CreateIndex
CREATE INDEX "upload_sessions_uploaded_by_idx" ON "upload_sessions"("uploaded_by");

-- CreateIndex
CREATE INDEX "upload_sessions_folder_id_idx" ON "upload_sessions"("folder_id");

-- CreateIndex
CREATE INDEX "upload_sessions_expires_at_idx" ON "upload_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "file_format_configs_category_idx" ON "file_format_configs"("category");

-- CreateIndex
CREATE INDEX "file_format_configs_is_enabled_idx" ON "file_format_configs"("is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "file_format_configs_extension_key" ON "file_format_configs"("extension");

-- CreateIndex
CREATE UNIQUE INDEX "real_folders_path_name_key" ON "real_folders"("path_name");

-- CreateIndex
CREATE INDEX "real_folders_path_name_idx" ON "real_folders"("path_name");

-- CreateIndex
CREATE INDEX "real_folders_is_system_idx" ON "real_folders"("is_system");

-- CreateIndex
CREATE INDEX "virtual_folders_parent_id_idx" ON "virtual_folders"("parent_id");

-- CreateIndex
CREATE INDEX "virtual_folders_real_folder_id_idx" ON "virtual_folders"("real_folder_id");

-- CreateIndex
CREATE INDEX "media_files_file_md5_idx" ON "media_files"("file_md5");

-- CreateIndex
CREATE INDEX "media_files_virtual_folder_id_idx" ON "media_files"("virtual_folder_id");

-- CreateIndex
CREATE INDEX "media_files_real_folder_id_idx" ON "media_files"("real_folder_id");

-- CreateIndex
CREATE INDEX "media_files_uploaded_by_idx" ON "media_files"("uploaded_by");

-- CreateIndex
CREATE INDEX "media_files_storage_type_idx" ON "media_files"("storage_type");

-- CreateIndex
CREATE INDEX "media_files_category_idx" ON "media_files"("category");

-- CreateIndex
CREATE INDEX "media_files_deleted_at_idx" ON "media_files"("deleted_at");

-- CreateIndex
CREATE INDEX "media_files_created_at_idx" ON "media_files"("created_at");

-- CreateIndex
CREATE INDEX "upload_logs_session_id_idx" ON "upload_logs"("session_id");

-- CreateIndex
CREATE INDEX "upload_logs_user_id_idx" ON "upload_logs"("user_id");

-- CreateIndex
CREATE INDEX "upload_logs_action_idx" ON "upload_logs"("action");

-- CreateIndex
CREATE INDEX "upload_logs_created_at_idx" ON "upload_logs"("created_at");

-- CreateIndex
CREATE INDEX "recycle_bin_original_type_idx" ON "recycle_bin"("original_type");

-- CreateIndex
CREATE INDEX "recycle_bin_deleted_by_idx" ON "recycle_bin"("deleted_by");

-- CreateIndex
CREATE INDEX "recycle_bin_deleted_at_idx" ON "recycle_bin"("deleted_at");

-- CreateIndex
CREATE INDEX "recycle_bin_purge_at_idx" ON "recycle_bin"("purge_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "system_configs_group_idx" ON "system_configs"("group");

-- CreateIndex
CREATE INDEX "system_configs_key_idx" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "security_logs_type_idx" ON "security_logs"("type");

-- CreateIndex
CREATE INDEX "security_logs_severity_idx" ON "security_logs"("severity");

-- CreateIndex
CREATE INDEX "security_logs_status_idx" ON "security_logs"("status");

-- CreateIndex
CREATE INDEX "security_logs_user_id_idx" ON "security_logs"("user_id");

-- CreateIndex
CREATE INDEX "security_logs_file_id_idx" ON "security_logs"("file_id");

-- CreateIndex
CREATE INDEX "security_logs_ip_address_idx" ON "security_logs"("ip_address");

-- CreateIndex
CREATE INDEX "security_logs_created_at_idx" ON "security_logs"("created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "permissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_real_folder_id_fkey" FOREIGN KEY ("real_folder_id") REFERENCES "real_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_shares" ADD CONSTRAINT "folder_shares_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_shares" ADD CONSTRAINT "folder_shares_shared_with_user_id_fkey" FOREIGN KEY ("shared_with_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_shares" ADD CONSTRAINT "folder_shares_shared_with_role_id_fkey" FOREIGN KEY ("shared_with_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_shares" ADD CONSTRAINT "folder_shares_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_folders" ADD CONSTRAINT "virtual_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "virtual_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_folders" ADD CONSTRAINT "virtual_folders_real_folder_id_fkey" FOREIGN KEY ("real_folder_id") REFERENCES "real_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_virtual_folder_id_fkey" FOREIGN KEY ("virtual_folder_id") REFERENCES "virtual_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_real_folder_id_fkey" FOREIGN KEY ("real_folder_id") REFERENCES "real_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_logs" ADD CONSTRAINT "security_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
