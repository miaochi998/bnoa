import { SetMetadata } from '@nestjs/common';

/**
 * 角色装饰器
 * 用于标记需要特定角色才能访问的接口
 * @param roles 需要的角色列表
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
