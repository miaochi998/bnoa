import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../config/prisma.service';
import { UserPayload } from '../decorators/current-user.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SUPER_ADMIN_ONLY_KEY } from '../decorators/super-admin-only.decorator';

interface CacheEntry {
    roles: string[];
    permissions: string[];
    expiresAt: number;
}

/**
 * 权限守卫
 * 1. 检查 @SuperAdminOnly() — 仅 super_admin 可访问
 * 2. 检查 @Permissions() — 按 role_permissions 表校验
 * 3. super_admin 角色豁免所有权限检查
 * 4. 内存缓存避免重复查库（5分钟过期）
 */
@Injectable()
export class PermissionGuard implements CanActivate {
    private readonly logger = new Logger(PermissionGuard.name);
    private readonly cache = new Map<string, CacheEntry>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟

    constructor(
        private reflector: Reflector,
        private prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // 公开接口跳过权限检查
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (isPublic) return true;

        const request = context.switchToHttp().getRequest();
        const user = request['user'] as UserPayload;

        if (!user?.sub) {
            throw new ForbiddenException('未登录');
        }

        // 获取用户角色和权限（带缓存）
        const { roles, permissions } = await this.getUserRolesAndPermissions(
            user.sub,
        );

        // 1. 检查 @SuperAdminOnly()
        const isSuperAdminOnly = this.reflector.getAllAndOverride<boolean>(
            SUPER_ADMIN_ONLY_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (isSuperAdminOnly) {
            if (!roles.includes('super_admin')) {
                throw new ForbiddenException('此操作仅限超级管理员');
            }
            return true;
        }

        // 2. 检查 @Permissions()
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()],
        );

        // 无权限要求，放行
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        // 3. super_admin 豁免所有权限检查
        if (roles.includes('super_admin')) {
            return true;
        }

        // 4. 检查细粒度权限
        const hasPermission = requiredPermissions.every((p) =>
            permissions.includes(p),
        );

        if (!hasPermission) {
            throw new ForbiddenException('权限不足');
        }

        return true;
    }

    /**
     * 获取用户角色编码和权限编码（带内存缓存）
     */
    private async getUserRolesAndPermissions(
        userId: string,
    ): Promise<{ roles: string[]; permissions: string[] }> {
        // 检查缓存
        const cached = this.cache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
            return { roles: cached.roles, permissions: cached.permissions };
        }

        // 查询数据库
        const userRoles = await this.prisma.userRole.findMany({
            where: { userId },
            include: {
                role: {
                    include: {
                        rolePermissions: {
                            include: { permission: true },
                        },
                    },
                },
            },
        });

        const roles: string[] = [];
        const permissionSet = new Set<string>();

        for (const ur of userRoles) {
            roles.push(ur.role.code);
            for (const rp of ur.role.rolePermissions) {
                permissionSet.add(rp.permission.code);
            }
        }

        const permissions = Array.from(permissionSet);

        // 写入缓存
        this.cache.set(userId, {
            roles,
            permissions,
            expiresAt: Date.now() + this.CACHE_TTL,
        });

        return { roles, permissions };
    }

    /**
     * 清除指定用户的缓存
     */
    clearUserCache(userId: string): void {
        this.cache.delete(userId);
    }

    /**
     * 清除指定角色下所有用户的缓存
     */
    async clearRoleUsersCache(roleId: string): Promise<void> {
        const userRoles = await this.prisma.userRole.findMany({
            where: { roleId },
            select: { userId: true },
        });

        for (const ur of userRoles) {
            this.cache.delete(ur.userId);
        }

        this.logger.log(
            `已清除角色 ${roleId} 下 ${userRoles.length} 个用户的权限缓存`,
        );
    }

    /**
     * 清除所有缓存
     */
    clearAllCache(): void {
        this.cache.clear();
    }
}
