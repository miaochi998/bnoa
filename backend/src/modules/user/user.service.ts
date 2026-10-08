import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { RealFolderService } from '../file/real-folder.service';
import { CreateUserInput, CreateUserInputRest } from './dto/create-user.dto';
import { UpdateUserInput, UpdateUserInputRest } from './dto/update-user.dto';
import {
  UserFilterInput,
  PageInput,
  UserFilterInputRest,
  PageInputRest,
} from './dto/user-filter.dto';
import { User, UserConnection } from './entities/user.entity';

// Prisma User with relations type
interface UserWithRelations {
  id: string;
  username: string;
  email: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  userRoles: Array<{
    role: {
      name: string;
    };
  }>;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private readonly realFolderService: RealFolderService,
  ) {}

  /**
   * 创建用户
   */
  async create(input: CreateUserInput | CreateUserInputRest): Promise<User> {
    const { username, email, password, name, phone, avatar, roleIds } = input as any;
    const normalizedUsername = String(username || '').trim();
    const normalizedEmail =
      typeof email === 'string' && email.trim() ? email.trim() : undefined;
    const normalizedName =
      typeof name === 'string' && name.trim() ? name.trim() : undefined;
    const normalizedPhone =
      typeof phone === 'string' && phone.trim() ? phone.trim() : undefined;
    const normalizedRoleIds: string[] = Array.isArray(roleIds)
      ? roleIds.filter((r) => typeof r === 'string' && r.trim())
      : [];

    if (!normalizedUsername) {
      throw new BadRequestException('用户名不能为空');
    }

    if (!normalizedRoleIds.length) {
      throw new BadRequestException('请选择至少一个角色');
    }

    // 检查用户名是否已存在
    const usernameExists = await this.prisma.user.findFirst({
      where: { username: normalizedUsername },
    });
    if (usernameExists) {
      throw new ConflictException('用户名已存在');
    }

    if (normalizedEmail) {
      const emailExists = await this.prisma.user.findFirst({
        where: { email: normalizedEmail },
      });
      if (emailExists) {
        throw new ConflictException('邮箱已存在');
      }
    }

    // 验证密码策略
    await this.validatePasswordPolicy(password);

    // 加密密码
    const hashedPassword = await CryptoUtil.hashPassword(password);

    const finalName = normalizedName || normalizedUsername;
    const finalEmail =
      normalizedEmail ||
      (await this.generateUniquePlaceholderEmail(normalizedUsername));

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        username: normalizedUsername,
        email: finalEmail,
        password: hashedPassword,
        name: finalName,
        phone: normalizedPhone ?? null,
        avatar,
        status: 'ACTIVE',
      },
    });

    // 分配角色
    await this.prisma.userRole.createMany({
      data: normalizedRoleIds.map((roleId) => ({
        userId: user.id,
        roleId,
      })),
    });

    // 自动为用户创建 user/{username} 真实文件夹
    await this.ensureUserRealFolder(user.username, finalName);

    this.logger.log(`用户创建成功: ${normalizedUsername}`);
    return this.findById(user.id);
  }

  private async generateUniquePlaceholderEmail(
    username: string,
  ): Promise<string> {
    const base = `${username}@bnoa.local`;
    const existsBase = await this.prisma.user.findFirst({
      where: { email: base },
      select: { id: true },
    });
    if (!existsBase) return base;

    for (let i = 2; i <= 50; i += 1) {
      const candidate = `${username}.${i}@bnoa.local`;
      const exists = await this.prisma.user.findFirst({
        where: { email: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }

    const suffix = Math.random().toString(36).slice(2, 8);
    return `${username}.${suffix}@bnoa.local`;
  }

  /**
   * 更新用户
   */
  async update(
    id: string,
    input: UpdateUserInput | UpdateUserInputRest,
  ): Promise<User> {
    const { email, name, phone, avatar, status, roleIds } = input;

    // 检查用户是否存在
    const existingUser = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingUser) {
      throw new NotFoundException('用户不存在');
    }

    // 检查邮箱是否被其他用户使用
    if (email && email !== existingUser.email) {
      const emailExists = await this.prisma.user.findFirst({
        where: { email, deletedAt: null, NOT: { id } },
      });
      if (emailExists) {
        throw new ConflictException('邮箱已被其他用户使用');
      }
    }

    // 更新用户信息

    const updateData: any = {
      email,
      name,
      phone,
      avatar,
    };

    if (status) {
      updateData.status = status;
    }

    await this.prisma.user.update({
      where: { id },

      data: updateData,
    });

    // 更新角色
    if (roleIds !== undefined) {
      // 删除现有角色
      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });

      // 添加新角色
      if (roleIds.length > 0) {
        await this.prisma.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId: id,
            roleId,
          })),
        });
      }
    }

    this.logger.log(`用户更新成功: ${id}`);
    return this.findById(id);
  }

  /**
   * 删除用户（软删除）
   */
  async delete(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 不允许删除超级管理员
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: id },
      include: { role: true },
    });

    const isSuperAdmin = userRoles.some((ur) => ur.role.code === 'super_admin');

    if (isSuperAdmin) {
      throw new BadRequestException('不能删除超级管理员');
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`用户删除成功: ${id}`);
  }

  /**
   * 根据数据库安全配置动态验证密码策略
   */
  private async validatePasswordPolicy(password: string): Promise<void> {
    const getNumber = async (
      key: string,
      def: number,
    ): Promise<number> => {
      try {
        const c = await this.prisma.config.findFirst({
          where: { key, deletedAt: null, isActive: true },
        });
        if (c) {
          const v = parseInt(c.value, 10);
          if (!isNaN(v) && v > 0) return v;
        }
      } catch { /* 忽略 */ }
      return def;
    };
    const getBoolean = async (
      key: string,
      def: boolean,
    ): Promise<boolean> => {
      try {
        const c = await this.prisma.config.findFirst({
          where: { key, deletedAt: null, isActive: true },
        });
        if (c) return c.value === 'true' || c.value === '1';
      } catch { /* 忽略 */ }
      return def;
    };

    const minLength = await getNumber('security.passwordMinLength', 8);
    const requireUppercase = await getBoolean(
      'security.passwordRequireUppercase',
      false,
    );
    const requireNumber = await getBoolean(
      'security.passwordRequireNumber',
      true,
    );

    const errors: string[] = [];
    if (password.length < minLength) {
      errors.push(`密码长度至少${minLength}个字符`);
    }
    if (requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }
    if (requireNumber && !/\d/.test(password)) {
      errors.push('密码必须包含数字');
    }
    if (errors.length > 0) {
      throw new BadRequestException(errors.join('；'));
    }
  }

  /**
   * 根据ID查找用户
   */
  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.mapToUserEntity(user);
  }

  /**
   * 查询用户列表
   */
  async findAll(
    filter: UserFilterInput | UserFilterInputRest,
    page: PageInput | PageInputRest,
  ): Promise<UserConnection> {
    const { keyword, status, roleId } = filter;
    const sortBy = (filter as UserFilterInputRest).sortBy;
    const sortOrder = (filter as UserFilterInputRest).sortOrder;
    const { page: pageNum, pageSize } = page;

    const where: any = {
      deletedAt: null,
    };

    // 关键字搜索
    if (keyword) {
      where.OR = [
        { username: { contains: keyword, mode: 'insensitive' } },
        { email: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 角色筛选
    if (roleId) {
      where.userRoles = {
        some: {
          roleId,
        },
      };
    }

    // 构建排序条件
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy && sortOrder) {
      orderBy = { [sortBy]: sortOrder };
    }

    const [users, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        orderBy,
      }),

      this.prisma.user.count({ where }),
    ]);

    return {
      nodes: users.map((user) => this.mapToUserEntity(user)),
      totalCount,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  /**
   * 获取当前用户信息
   */
  async getMe(userId: string): Promise<User> {
    return this.findById(userId);
  }

  /**
   * 修改用户密码
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证旧密码
    const isPasswordValid = await CryptoUtil.comparePassword(
      oldPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('旧密码错误');
    }

    // 加密新密码
    const hashedPassword = await CryptoUtil.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(`用户密码修改成功: ${userId}`);
  }

  /**
   * 重置用户密码（管理员功能）
   */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const hashedPassword = await CryptoUtil.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(`用户密码重置成功: ${userId}`);
  }

  /**
   * 确保用户拥有 user/{username} 真实文件夹
   * 如果已存在则跳过，不存在则创建
   */
  async ensureUserRealFolder(username: string, displayName: string): Promise<void> {
    const pathName = `user/${username}`;
    let realFolder: any = null;

    try {
      realFolder = await this.realFolderService.findByPath(pathName);
      if (realFolder) {
        this.logger.log(`用户真实文件夹已存在: ${pathName}`);
      }
    } catch {
      // findByPath 返回 null 时不会抛异常，这里是防御性代码
    }

    // 1. 确保 RealFolder 存在
    if (!realFolder) {
      try {
        realFolder = await this.realFolderService.create({
          pathName,
          displayName: `${displayName}的文件夹`,
          description: `用户 ${username} 的个人存储空间`,
        });
        this.logger.log(`为用户创建真实文件夹: ${pathName}`);
      } catch (error) {
        this.logger.warn(
          `为用户创建真实文件夹失败: ${pathName}`,
          (error as Error).message,
        );
        return;
      }
    }

    // 2. 确保用户有 Folder 根目录
    try {
      const user = await this.prisma.user.findFirst({
        where: { username, deletedAt: null },
      });
      if (!user) return;

      const existingFolder = await this.prisma.folder.findFirst({
        where: {
          createdBy: user.id,
          parentId: null,
          isSystemShared: false,
          deletedAt: null,
        },
      });

      if (!existingFolder) {
        await this.prisma.folder.create({
          data: {
            name: '我的文件',
            realFolderId: realFolder.id,
            createdBy: user.id,
          },
        });
        this.logger.log(`为用户创建 Folder 根目录: ${username}`);
      }
    } catch (error) {
      this.logger.warn(
        `为用户创建 Folder 根目录失败: ${username}`,
        (error as Error).message,
      );
    }
  }

  /**
   * 映射到 User 实体
   */
  private mapToUserEntity(user: UserWithRelations): User {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      phone: user.phone || undefined,
      avatar: user.avatar || undefined,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt || undefined,
      roles: user.userRoles?.map((ur) => ur.role.name) || [],
    };
  }
}
