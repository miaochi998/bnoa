import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { FieldPermissionService } from './field-permission.service';

/**
 * 字段级（信息）权限服务模块
 *
 * 单独抽出、**只依赖 PrismaModule**，供各业务模块按需引用。
 * 目的：避免「业务模块 → RoleModule → AuthModule → StorageModule → ConfigModule」
 * 这类链路形成模块循环依赖（系统配置模块引用 RoleModule 时曾因此导致服务起不来）。
 * 本模块是 FieldPermissionService 的**唯一定义处**，RoleModule 也引用它以保证单实例。
 */
@Module({
  imports: [PrismaModule],
  providers: [FieldPermissionService],
  exports: [FieldPermissionService],
})
export class FieldPermissionModule {}
