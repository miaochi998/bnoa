import { SetMetadata } from '@nestjs/common';

/**
 * 超级管理员专属装饰器
 * 标记仅 super_admin 角色可访问的接口
 */
export const SUPER_ADMIN_ONLY_KEY = 'superAdminOnly';
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_ONLY_KEY, true);
