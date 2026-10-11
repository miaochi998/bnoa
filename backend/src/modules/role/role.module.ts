import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { PermissionController } from './permission.controller';
import { FieldPermissionService } from './field-permission.service';
import { FieldPermissionController } from './field-permission.controller';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PrismaModule } from '../../config/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FieldPermissionModule } from './field-permission.module';

/**
 * 角色权限模块
 * 提供角色管理、权限管理、权限控制等功能
 */
@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, FieldPermissionModule],
  providers: [RoleService, PermissionGuard],
  controllers: [RoleController, PermissionController, FieldPermissionController],
  exports: [RoleService, PermissionGuard, FieldPermissionModule],
})
export class RoleModule {}
