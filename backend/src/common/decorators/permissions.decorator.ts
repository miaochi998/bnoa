import { SetMetadata } from '@nestjs/common';

/**
 * 权限装饰器
 * 用于标记需要特定权限才能访问的接口
 * @param permissions 需要的权限列表（AND 逻辑）
 */
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);
