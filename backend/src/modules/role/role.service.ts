import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PERMISSION_DEFINITIONS } from '../../config/permission-definitions';
import { PermissionGuard } from '../../common/guards/permission.guard';
import {
  CreateRoleDto,
  UpdateRoleDto,
  QueryRoleDto,
  AssignPermissionsDto,
  AssignRolesDto,
  RoleInfo,
  RoleStatus,
  PaginationMeta,
} from './dto/role.dto';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  QueryPermissionDto,
  PermissionInfo,
  PermissionTreeNode,
  PermissionType,
} from './dto/permission.dto';

/**
 * Prisma 角色类型
 */
interface PrismaRole {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Prisma 权限类型
 */
interface PrismaPermission {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 角色权限服务
 * 提供角色和权限的管理功能
 */
@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionGuard: PermissionGuard,
  ) {}

  // ==================== 角色管理 ====================

  /**
   * 创建角色
   * @param dto 创建角色DTO
   * @param userId 操作人ID
   * @returns 角色信息
   */
  async createRole(dto: CreateRoleDto, userId: string): Promise<RoleInfo> {
    // 检查角色编码是否已存在
    const existingRole = await this.prisma.role.findFirst({
      where: {
        code: dto.code,
        deletedAt: null,
      },
    });

    if (existingRole) {
      throw new ConflictException(`角色编码 ${dto.code} 已存在`);
    }

    try {
      const role = await this.prisma.$transaction(async (tx) => {
        // 创建角色
        const newRole = await tx.role.create({
          data: {
            name: dto.name,
            code: dto.code,
            description: dto.description,
            isActive: dto.status === RoleStatus.ACTIVE,
            createdBy: userId,
          },
        });

        // 关联权限
        if (dto.permissionIds && dto.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: dto.permissionIds.map((permissionId) => ({
              roleId: newRole.id,
              permissionId,
              createdBy: userId,
            })),
          });
        }

        return newRole;
      });

      this.logger.log(`角色创建成功: ${role.name} (${role.code})`);

      return this.toRoleInfo(role);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`创建角色失败: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * 更新角色
   * @param id 角色ID
   * @param dto 更新角色DTO
   * @param userId 操作人ID
   * @returns 角色信息
   */
  async updateRole(
    id: string,
    dto: UpdateRoleDto,
    userId: string,
  ): Promise<RoleInfo> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    // 超级管理员角色保护
    if (role.code === 'super_admin') {
      throw new BadRequestException(
          '超级管理员角色为系统内置角色，不可编辑',
      );
    }

    try {
      const updatedRole = await this.prisma.$transaction(async (tx) => {
        // 更新角色基本信息
        const updated = await tx.role.update({
          where: { id },
          data: {
            name: dto.name,
            description: dto.description,
            isActive: dto.status === RoleStatus.ACTIVE,
          },
        });

        // 更新权限关联
        if (dto.permissionIds !== undefined) {
          // 删除旧关联
          await tx.rolePermission.deleteMany({
            where: { roleId: id },
          });

          // 创建新关联
          if (dto.permissionIds.length > 0) {
            await tx.rolePermission.createMany({
              data: dto.permissionIds.map((permissionId) => ({
                roleId: id,
                permissionId,
                createdBy: userId,
              })),
            });
          }
        }

        return updated;
      });

      this.logger.log(`角色更新成功: ${updatedRole.name}`);

      return this.toRoleInfo(updatedRole);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`更新角色失败: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * 删除角色
   * @param id 角色ID
   * @param _userId 操作人ID（保留用于审计）
   */
  async deleteRole(
    id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    // 超级管理员角色保护
    if (role.code === 'super_admin') {
      throw new BadRequestException(
          '超级管理员角色为系统内置角色，不可删除',
      );
    }

    // 检查是否有关联用户
    const userCount = await this.prisma.userRole.count({
      where: { roleId: id },
    });

    if (userCount > 0) {
      throw new BadRequestException('该角色下有关联用户，无法删除');
    }

    await this.prisma.role.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    this.logger.log(`角色删除成功: ${role.name}`);
  }

  /**
   * 获取角色详情
   * @param id 角色ID
   * @returns 角色信息
   */
  async getRoleById(id: string): Promise<RoleInfo> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    return this.toRoleInfo(role);
  }

  /**
   * 查询角色列表
   * @param query 查询条件
   * @returns 角色列表和分页信息
   */
  async findRoles(
    query: QueryRoleDto,
  ): Promise<{ items: RoleInfo[]; meta: PaginationMeta }> {
    const { keyword, status, page = 1, pageSize = 20 } = query;

    const where: any = {
      deletedAt: null,
    };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { code: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.isActive = status === RoleStatus.ACTIVE;
    }

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.role.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: roles.map((role) => this.toRoleInfo(role)),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * 获取所有角色
   * @returns 角色列表
   */
  async findAllRoles(): Promise<RoleInfo[]> {
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return roles.map((role) => this.toRoleInfo(role));
  }

  /**
   * 分配权限给角色
   * @param roleId 角色ID
   * @param dto 分配权限DTO
   * @param userId 操作人ID
   */
  async assignPermissions(
    roleId: string,
    dto: AssignPermissionsDto,
    userId: string,
  ): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    // 超级管理员角色保护
    if (role.code === 'super_admin') {
      throw new BadRequestException(
          '超级管理员角色拥有所有权限，不可手动配置',
      );
    }

    // 验证权限是否存在
    const permissions = await this.prisma.permission.findMany({
      where: {
        id: { in: dto.permissionIds },
      },
    });

    if (permissions.length !== dto.permissionIds.length) {
      throw new BadRequestException('部分权限不存在');
    }

    await this.prisma.$transaction(async (tx) => {
      // 删除旧关联
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // 创建新关联
      if (dto.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
            createdBy: userId,
          })),
        });
      }
    });

    await this.permissionGuard.clearRoleUsersCache(roleId);
    this.logger.log(`角色权限分配成功: ${role.name}`);
  }

  // ==================== 权限管理 ====================

  /**
   * 创建权限
   * @param dto 创建权限DTO
   * @param _userId 操作人ID（保留用于审计）
   * @returns 权限信息
   */
  async createPermission(
    dto: CreatePermissionDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<PermissionInfo> {
    // 检查权限编码是否已存在
    const existingPermission = await this.prisma.permission.findFirst({
      where: {
        code: dto.code,
      },
    });

    if (existingPermission) {
      throw new ConflictException(`权限编码 ${dto.code} 已存在`);
    }

    const permission = await this.prisma.permission.create({
      data: {
        name: dto.name,
        code: dto.code,
        type: dto.type,
        parentId: dto.parentId,
        description: dto.description || '',
        sortOrder: dto.sortOrder,
      },
    });

    this.logger.log(`权限创建成功: ${permission.name} (${permission.code})`);

    return this.toPermissionInfo(permission);
  }

  /**
   * 更新权限
   * @param id 权限ID
   * @param dto 更新权限DTO
   * @param _userId 操作人ID（保留用于审计）
   * @returns 权限信息
   */
  async updatePermission(
    id: string,
    dto: UpdatePermissionDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<PermissionInfo> {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException('权限不存在');
    }

    const updatedPermission = await this.prisma.permission.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder,
      },
    });

    this.logger.log(`权限更新成功: ${updatedPermission.name}`);

    return this.toPermissionInfo(updatedPermission);
  }

  /**
   * 删除权限
   * @param id 权限ID
   * @param _userId 操作人ID（保留用于审计）
   */
  async deletePermission(
    id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<void> {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException('权限不存在');
    }

    // 检查是否有子权限
    const childCount = await this.prisma.permission.count({
      where: { parentId: id },
    });

    if (childCount > 0) {
      throw new BadRequestException('该权限下有子权限，无法删除');
    }

    // 检查是否有关联角色
    const roleCount = await this.prisma.rolePermission.count({
      where: { permissionId: id },
    });

    if (roleCount > 0) {
      throw new BadRequestException('该权限已分配给角色，无法删除');
    }

    await this.prisma.permission.delete({
      where: { id },
    });

    this.logger.log(`权限删除成功: ${permission.name}`);
  }

  /**
   * 获取权限详情
   * @param id 权限ID
   * @returns 权限信息
   */
  async getPermissionById(id: string): Promise<PermissionInfo> {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException('权限不存在');
    }

    return this.toPermissionInfo(permission);
  }

  /**
   * 同步权限定义到数据库（仅新增/更新，不删除已有权限）
   * 用于生产环境升级后补齐缺失的权限
   */
  async syncPermissions(): Promise<{ added: number; updated: number; total: number }> {
    const permissionMap = new Map<string, string>();
    let added = 0;
    let updated = 0;

    for (const perm of PERMISSION_DEFINITIONS) {
      const existing = await this.prisma.permission.findUnique({
        where: { code: perm.code },
      });
      const created = await this.prisma.permission.upsert({
        where: { code: perm.code },
        update: { name: perm.name, description: perm.description, type: perm.type },
        create: { name: perm.name, code: perm.code, type: perm.type, description: perm.description },
      });
      if (existing) updated += 1;
      else added += 1;
      permissionMap.set(perm.code, created.id);
    }

    for (const perm of PERMISSION_DEFINITIONS) {
      if (perm.parentCode) {
        const parentId = permissionMap.get(perm.parentCode);
        const permId = permissionMap.get(perm.code);
        if (parentId && permId) {
          await this.prisma.permission.update({
            where: { id: permId },
            data: { parentId },
          });
        }
      }
    }

    const total = await this.prisma.permission.count();
    this.logger.log(`权限同步完成: 新增 ${added}, 更新 ${updated}, 当前总数 ${total}`);
    return { added, updated, total };
  }

  /**
   * 查询权限列表
   * @param query 查询条件
   * @returns 权限列表
   */
  async findPermissions(query: QueryPermissionDto): Promise<PermissionInfo[]> {
    const { keyword, type } = query;

    const where: any = {};

    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { code: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.type = type;
    }

    const permissions = await this.prisma.permission.findMany({
      where,
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
    });

    return permissions.map((permission) => this.toPermissionInfo(permission));
  }

  /**
   * 获取权限树
   * @returns 权限树结构
   */
  async getPermissionTree(): Promise<PermissionTreeNode[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
    });

    return this.buildPermissionTree(permissions);
  }

  // ==================== 用户角色关联 ====================

  /**
   * 分配角色给用户
   * @param userId 用户ID
   * @param dto 分配角色DTO
   * @param operatorId 操作人ID
   */
  async assignRolesToUser(
    userId: string,
    dto: AssignRolesDto,
    operatorId: string,
  ): Promise<void> {
    // 验证用户是否存在
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证角色是否存在
    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: dto.roleIds },
        deletedAt: null,
        isActive: true,
      },
    });

    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException('部分角色不存在或已禁用');
    }

    await this.prisma.$transaction(async (tx) => {
      // 删除旧关联
      await tx.userRole.deleteMany({
        where: { userId },
      });

      // 创建新关联
      if (dto.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({
            userId,
            roleId,
            createdBy: operatorId,
          })),
        });
      }
    });

    this.logger.log(`用户角色分配成功: ${user.username}`);
  }

  /**
   * 获取用户的角色列表
   * @param userId 用户ID
   * @returns 角色列表
   */
  async getUserRoles(userId: string): Promise<RoleInfo[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
      },
    });

    return userRoles.map((ur) => this.toRoleInfo(ur.role));
  }

  /**
   * 获取角色的权限列表
   * @param roleId 角色ID
   * @returns 权限列表
   */
  async getRolePermissions(roleId: string): Promise<PermissionInfo[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: true,
      },
    });

    return rolePermissions.map((rp) => this.toPermissionInfo(rp.permission));
  }

  /**
   * 获取用户的角色编码列表
   * @param userId 用户ID
   * @returns 角色编码列表
   */
  async getUserRoleCodes(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    return userRoles.map((ur) => ur.role.code);
  }

  /**
   * 获取用户的所有权限编码
   * @param userId 用户ID
   * @returns 权限编码列表
   */
  async getUserPermissionCodes(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissionCodes = new Set<string>();

    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissionCodes.add(rolePermission.permission.code);
      }
    }

    return Array.from(permissionCodes);
  }

  // ==================== 私有方法 ====================

  private toRoleInfo(role: PrismaRole): RoleInfo {
    return {
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description ?? undefined,
      status: role.isActive ? RoleStatus.ACTIVE : RoleStatus.INACTIVE,
      permissionCount: 0,
      userCount: 0,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  private toPermissionInfo(permission: PrismaPermission): PermissionInfo {
    return {
      id: permission.id,
      name: permission.name,
      code: permission.code,
      type: permission.type as PermissionType,
      parentId: permission.parentId ?? undefined,
      description: permission.description ?? undefined,
      sortOrder: permission.sortOrder,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    };
  }

  private buildPermissionTree(
    permissions: PrismaPermission[],
  ): PermissionTreeNode[] {
    const map = new Map<string, PermissionTreeNode>();
    const roots: PermissionTreeNode[] = [];

    // 创建节点映射
    for (const permission of permissions) {
      map.set(permission.id, {
        ...this.toPermissionInfo(permission),
        children: [],
      });
    }

    // 构建树结构
    for (const permission of permissions) {
      const node = map.get(permission.id)!;
      if (permission.parentId) {
        const parent = map.get(permission.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
