import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { PermissionController } from './permission.controller';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PrismaModule } from '../../config/prisma.module';
import { AuthModule } from '../auth/auth.module';

/**
 * 角色权限模块
 * 提供角色管理、权限管理、权限控制等功能
 */
@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  providers: [RoleService, PermissionGuard],
  controllers: [RoleController, PermissionController],
  exports: [RoleService, PermissionGuard],
})
export class RoleModule {}
