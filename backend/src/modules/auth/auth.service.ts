import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { CaptchaService } from '../captcha/captcha.service';
import { EmailService } from '../email/email.service';
import {
    CodePurpose,
    EmailCategory,
} from '../email/interfaces/email.interfaces';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import {
  RefreshTokenDto,
  RefreshTokenResponseDto,
} from './dto/refresh-token.dto';
import { RegisterDto, RegisterResponseDto } from './dto/register.dto';
import { ChangePasswordDto, ResetPasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import sharp from 'sharp';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(forwardRef(() => StorageService))
    private storageService: StorageService,
    @Inject(forwardRef(() => LocalStorageService))
    private localStorageService: LocalStorageService,
    private captchaService: CaptchaService,
    private emailService: EmailService,
  ) {}

  /**
   * 用户登录
   */
  async login(
    dto: LoginDto,
    ip: string,
    userAgent: string,
  ): Promise<LoginResponseDto> {
    const { username, password } = dto;

    // 验证验证码 Token
    const captchaConfig = await this.captchaService.getFullConfig();
    if (captchaConfig.enabled && captchaConfig.loginRequired) {
      if (!dto.captchaToken) {
        throw new BadRequestException('请先完成验证码验证');
      }
      const isValid = await this.captchaService.verifyToken(
        dto.captchaToken,
      );
      if (!isValid) {
        throw new BadRequestException(
          '验证码已过期，请重新验证',
        );
      }
    }

    // 查找用户（支持用户名、邮箱、手机号登录）
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ username }, { email: username }, { phone: username }],
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      this.logger.warn(`登录失败：用户不存在 - ${username}`);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 检查账户状态
    if (user.status === 'INACTIVE') {
      throw new ForbiddenException('账户已被禁用');
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('账户已被暂停');
    }

    // 检查账户是否被锁定
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `账户已锁定，请${remainingMinutes}分钟后重试`,
      );
    }

    // 验证密码
    const isPasswordValid = await CryptoUtil.comparePassword(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      // 从数据库配置读取登录安全策略
      const maxAttempts = await this.getSecurityNumber(
        'security.loginMaxAttempts',
        5,
      );
      const lockoutDurationSec = await this.getSecurityNumber(
        'security.lockoutDuration',
        1800,
      );

      // 更新失败次数
      const failedAttempts = user.failedAttempts + 1;
      const shouldLock = failedAttempts >= maxAttempts;
      const lockoutMinutes = Math.ceil(lockoutDurationSec / 60);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + lockoutDurationSec * 1000)
            : null,
        },
      });

      if (shouldLock) {
        throw new ForbiddenException(
          `密码错误次数过多，账户已锁定${lockoutMinutes}分钟`,
        );
      }

      this.logger.warn(
        `登录失败：密码错误 - ${username} (第${failedAttempts}次)`,
      );
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 登录成功，更新用户信息
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        loginCount: { increment: 1 },
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    // 生成令牌
    const tokens = await this.generateTokens(user);

    // 保存刷新令牌
    await this.saveRefreshToken(user.id, tokens.refreshToken, userAgent, ip);

    this.logger.log(`用户登录成功: ${user.username} (${user.id})`);

    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        avatar: user.avatar || undefined,
        roles: user.userRoles.map((ur) => ur.role.code),
      },
    };
  }

  /**
   * 用户注册
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const { username, email, password, name, phone } = dto;

    // 检查用户名是否已存在
    const existingUser = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new ConflictException('用户名已存在');
      }
      if (existingUser.email === email) {
        throw new ConflictException('邮箱已被注册');
      }
    }

    // 检查手机号是否已存在
    if (phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone, deletedAt: null },
      });
      if (existingPhone) {
        throw new ConflictException('手机号已被注册');
      }
    }

    // 验证密码策略
    await this.validatePasswordPolicy(password);

    // 加密密码
    const hashedPassword = await CryptoUtil.hashPassword(password);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        name,
        phone,
        status: 'ACTIVE',
      },
    });

    this.logger.log(`用户注册成功: ${username} (${user.id})`);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  /**
   * 刷新令牌
   */
  async refreshToken(dto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    const { refreshToken } = dto;

    // 查找刷新令牌
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: {
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('无效的刷新令牌');
    }

    // 检查令牌是否过期或被撤销
    if (tokenRecord.isRevoked) {
      throw new UnauthorizedException('刷新令牌已被撤销');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('刷新令牌已过期');
    }

    // 检查用户状态
    if (tokenRecord.user.status !== 'ACTIVE') {
      throw new ForbiddenException('账户状态异常');
    }

    // 撤销旧令牌
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    // 生成新令牌
    const tokens = await this.generateTokens(tokenRecord.user);

    // 保存新刷新令牌
    await this.saveRefreshToken(
      tokenRecord.userId,
      tokens.refreshToken,
      tokenRecord.userAgent || undefined,
      tokenRecord.ip || undefined,
    );

    this.logger.log(`令牌刷新成功: ${tokenRecord.user.username}`);

    return tokens;
  }

  /**
   * 用户登出
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // 撤销指定刷新令牌
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    } else {
      // 撤销该用户的所有刷新令牌
      await this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    }

    this.logger.log(`用户登出: ${userId}`);
  }

  /**
   * 修改密码
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const { oldPassword, newPassword, confirmPassword } = dto;

    // 检查两次密码是否一致
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致');
    }

    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 验证旧密码
    const isOldPasswordValid = await CryptoUtil.comparePassword(
      oldPassword,
      user.password,
    );

    if (!isOldPasswordValid) {
      throw new BadRequestException('旧密码错误');
    }

    // 验证新密码策略
    await this.validatePasswordPolicy(newPassword);

    // 加密新密码
    const hashedNewPassword = await CryptoUtil.hashPassword(newPassword);

    // 更新密码
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // 撤销所有刷新令牌（强制重新登录）
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    this.logger.log(`用户修改密码成功: ${user.username}`);

    // 发送密码修改通知邮件
    if (user.email) {
        await this.emailService.send({
            to: user.email,
            subject: '【BNOA】密码修改通知',
            template: 'password-changed',
            data: { username: user.username },
            category: EmailCategory.NOTIFICATION,
            userId: user.id,
        }).catch(err => {
            this.logger.warn(
                `密码修改通知邮件发送失败: ${err.message}`,
            );
        });
    }
  }

  /**
   * 发送密码重置验证码
   */
  async sendResetCode(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
    });
    if (!user) {
      // 出于安全考虑，不暴露邮箱是否存在
      return;
    }
    await this.emailService.sendCode({
      to: email,
      purpose: CodePurpose.PASSWORD_RESET,
      userId: user.id,
    });
  }

  /**
   * 重置密码
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const { email, newPassword, verificationCode } = dto;

    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 验证邮箱验证码
    const isValid = await this.emailService.verifyCode(
      email, CodePurpose.PASSWORD_RESET, verificationCode,
    );
    if (!isValid) {
      throw new BadRequestException('验证码错误或已过期');
    }

    // 加密新密码
    const hashedNewPassword = await CryptoUtil.hashPassword(newPassword);

    // 更新密码
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    });

    // 撤销所有刷新令牌
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    this.logger.log(`用户重置密码成功: ${user.username}`);
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const roleCodes = user.userRoles.map((ur) => ur.role.code);
    const isSuperAdmin = roleCodes.includes('super_admin');

    // super_admin 返回 ['*']，其他用户返回实际权限编码
    let permissions: string[];
    if (isSuperAdmin) {
      permissions = ['*'];
    } else {
      const permissionSet = new Set<string>();
      for (const ur of user.userRoles) {
        for (const rp of ur.role.rolePermissions) {
          permissionSet.add(rp.permission.code);
        }
      }
      permissions = Array.from(permissionSet);
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      name: user.name,
      avatar: user.avatar,
      status: user.status,
      description: user.description,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        code: ur.role.code,
      })),
      permissions,
    };
  }

  /**
   * 更新个人资料
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 检查邮箱唯一性
    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          id: { not: userId },
          deletedAt: null,
        },
      });
      if (existing) {
        throw new ConflictException('该邮箱已被使用');
      }
    }

    // 检查手机号唯一性
    if (dto.phone && dto.phone !== user.phone) {
      const existing = await this.prisma.user.findFirst({
        where: {
          phone: dto.phone,
          id: { not: userId },
          deletedAt: null,
        },
      });
      if (existing) {
        throw new ConflictException('该手机号已被使用');
      }
    }

    const updateData: Record<string, string | null> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) {
      updateData.phone = dto.phone || null;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description || null;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    this.logger.log(`用户更新个人资料: ${user.username}`);

    return this.getCurrentUser(userId);
  }

  /**
   * 上传头像
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatar: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 读取头像配置
    const maxSizeMB = await this.getAvatarNumber('avatar.maxSize', 2);
    const allowedFormats = await this.getAvatarString(
      'avatar.allowedFormats',
      'jpg,jpeg,png,webp',
    );

    // 验证文件大小
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new BadRequestException(
        `头像文件大小不能超过${maxSizeMB}MB`,
      );
    }

    // 验证文件格式
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const allowed = allowedFormats.split(',').map((f) => f.trim().toLowerCase());
    if (!allowed.includes(ext)) {
      throw new BadRequestException(
        `不支持的头像格式，允许: ${allowedFormats}`,
      );
    }

    // 处理图片（尺寸调整和压缩）
    const processedBuffer = await this.processAvatarImage(file.buffer, ext);

    // 获取存储文件夹路径
    const folderPath = await this.getAvatarFolderPath();

    // 生成唯一文件名
    const fileName = `${uuidv4()}.${ext}`;
    const key = `${folderPath}/${fileName}`;

    // 上传文件
    await this.avatarUpload(processedBuffer, key, file.mimetype);

    // 物理删除旧头像
    if (user.avatar) {
      await this.deleteAvatarFile(user.avatar);
    }

    // 更新用户头像（存储 storageKey）
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: key },
    });

    this.logger.log(`用户上传头像成功: ${user.username}`);
    return { avatar: key };
  }

  /**
   * 删除头像
   */
  async deleteAvatar(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    if (!user.avatar) {
      throw new BadRequestException('当前没有设置头像');
    }

    // 物理删除头像文件
    await this.deleteAvatarFile(user.avatar);

    // 清空用户头像
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
    });

    this.logger.log(`用户删除头像成功: ${user.username}`);
  }

  /**
   * 上传默认头像（管理员）
   */
  async uploadDefaultAvatar(
    file: Express.Multer.File,
  ): Promise<{ defaultAvatar: string }> {
    // 读取头像配置
    const maxSizeMB = await this.getAvatarNumber('avatar.maxSize', 2);
    const allowedFormats = await this.getAvatarString(
      'avatar.allowedFormats',
      'jpg,jpeg,png,webp',
    );

    // 验证文件大小
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new BadRequestException(
        `头像文件大小不能超过${maxSizeMB}MB`,
      );
    }

    // 验证文件格式
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const allowed = allowedFormats.split(',').map((f) => f.trim().toLowerCase());
    if (!allowed.includes(ext)) {
      throw new BadRequestException(
        `不支持的头像格式，允许: ${allowedFormats}`,
      );
    }

    // 处理图片（尺寸调整和压缩）
    const processedBuffer = await this.processAvatarImage(file.buffer, ext);

    // 获取存储文件夹路径
    const folderPath = await this.getAvatarFolderPath();

    // 生成唯一文件名
    const fileName = `default-avatar.${ext}`;
    const key = `${folderPath}/${fileName}`;

    // 删除旧默认头像
    const oldDefaultAvatar = await this.getAvatarString(
      'avatar.defaultAvatar',
      '',
    );
    if (oldDefaultAvatar) {
      await this.deleteAvatarFile(oldDefaultAvatar);
    }

    // 上传文件
    await this.avatarUpload(processedBuffer, key, file.mimetype);

    // 更新配置（存储 storageKey）
    await this.prisma.config.updateMany({
      where: { key: 'avatar.defaultAvatar', deletedAt: null },
      data: { value: key },
    });

    this.logger.log(`默认头像上传成功: ${key}`);
    return { defaultAvatar: key };
  }

  /**
   * 获取头像存储文件夹路径
   */
  private async getAvatarFolderPath(): Promise<string> {
    const realFolderId = await this.getAvatarString(
      'avatar.realFolderId',
      '',
    );

    if (realFolderId) {
      const realFolder = await this.prisma.realFolder.findUnique({
        where: { id: realFolderId },
      });
      if (realFolder) {
        return realFolder.pathName;
      }
    }

    // 默认回退到 system/avatars
    return 'system/avatars';
  }

  /**
   * 获取头像存储类型
   */
  private async getStorageType(): Promise<'rustfs' | 'local'> {
    const type = await this.getAvatarString('avatar.storageType', 'rustfs');
    return type === 'local' ? 'local' : 'rustfs';
  }

  /**
   * 上传头像文件（根据存储类型选择 RustFS 或本地）
   */
  private async avatarUpload(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<void> {
    const storageType = await this.getStorageType();
    if (storageType === 'local') {
      await this.localStorageService.uploadFile(buffer, key);
    } else {
      await this.storageService.upload(buffer, key, mimeType);
    }
  }

  /**
   * 下载头像文件（根据存储类型选择 RustFS 或本地，失败时回退）
   */
  private async avatarDownload(key: string): Promise<Buffer> {
    const storageType = await this.getStorageType();
    try {
      if (storageType === 'local') {
        return await this.localStorageService.downloadFile(key);
      }
      return await this.storageService.download(key);
    } catch {
      // 主存储失败，尝试备用存储（兼容存储类型切换场景）
      if (storageType === 'local') {
        return this.storageService.download(key);
      }
      return this.localStorageService.downloadFile(key);
    }
  }

  /**
   * 根据 storageKey 删除头像文件（两种存储都尝试删除）
   */
  private async deleteAvatarFile(storageKey: string): Promise<void> {
    if (!storageKey) return;
    // 两种存储都尝试删除，确保切换存储类型后旧文件也能清理
    try {
      await this.storageService.delete(storageKey);
    } catch {
      // 忽略：文件可能不在 RustFS 中
    }
    try {
      await this.localStorageService.deleteFile(storageKey);
    } catch {
      // 忽略：文件可能不在本地
    }
    this.logger.log(`头像文件删除完成: ${storageKey}`);
  }

  /**
   * 处理头像图片：调整尺寸和压缩
   */
  private async processAvatarImage(
    buffer: Buffer,
    ext: string,
  ): Promise<Buffer> {
    const avatarSize = await this.getAvatarNumber('avatar.size', 200);
    const autoCompress = await this.getAvatarString(
      'avatar.autoCompress',
      'true',
    );
    const compressQuality = await this.getAvatarNumber(
      'avatar.compressQuality',
      80,
    );

    let pipeline = sharp(buffer).resize(avatarSize, avatarSize, {
      fit: 'cover',
      position: 'center',
    });

    const shouldCompress = autoCompress === 'true' || autoCompress === '1';
    const quality = shouldCompress
      ? Math.max(1, Math.min(100, compressQuality))
      : 100;

    if (ext === 'png') {
      pipeline = pipeline.png({ quality });
    } else if (ext === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else {
      pipeline = pipeline.jpeg({ quality });
    }

    return pipeline.toBuffer();
  }

  /**
   * 获取用户头像数据（用于代理端点）
   */
  async getAvatarBuffer(
    userId: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });
    if (!user?.avatar) return null;

    try {
      const buffer = await this.avatarDownload(user.avatar);
      const ext = path.extname(user.avatar).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
      };
      const mimeType = mimeMap[ext] || 'image/jpeg';
      return { buffer, mimeType };
    } catch (error) {
      this.logger.warn(`获取头像文件失败: ${user.avatar}`, error);
      return null;
    }
  }

  /**
   * 获取默认头像数据（用于代理端点）
   */
  async getDefaultAvatarBuffer(): Promise<{
    buffer: Buffer;
    mimeType: string;
  } | null> {
    const key = await this.getAvatarString(
      'avatar.defaultAvatar',
      '',
    );
    if (!key) return null;

    try {
      const buffer = await this.avatarDownload(key);
      const ext = path.extname(key).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
      };
      const mimeType = mimeMap[ext] || 'image/jpeg';
      return { buffer, mimeType };
    } catch (error) {
      this.logger.warn(`获取默认头像文件失败: ${key}`, error);
      return null;
    }
  }

  /**
   * 读取头像配置（字符串）
   */
  private async getAvatarString(
    key: string,
    defaultValue: string,
  ): Promise<string> {
    try {
      const config = await this.prisma.config.findFirst({
        where: { key, deletedAt: null, isActive: true },
      });
      if (config && config.value !== null && config.value !== undefined) {
        return config.value;
      }
    } catch {
      this.logger.warn(`读取头像配置 ${key} 失败`);
    }
    return defaultValue;
  }

  /**
   * 读取头像配置（数字）
   */
  private async getAvatarNumber(
    key: string,
    defaultValue: number,
  ): Promise<number> {
    const value = await this.getAvatarString(key, String(defaultValue));
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * 生成访问令牌和刷新令牌
   */
  private async generateTokens(user: {
    id: string;
    username: string;
    email: string;
    userRoles?: { role: { code: string } }[];
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  }> {
    const roles = user.userRoles?.map((ur) => ur.role.code) || [];
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles,
    };

    // 优先从数据库系统配置读取会话超时时间，回退到环境变量
    const accessTokenExpiration = await this.getAccessTokenExpiration();
    const refreshTokenExpiration = this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessTokenExpiration as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
      this.jwtService.signAsync(payload, {
        expiresIn:
          refreshTokenExpiration as `${number}${'s' | 'm' | 'h' | 'd'}`,
        secret: this.configService.get<string>('JWT_SECRET') + '_refresh',
      }),
    ]);

    // 解析过期时间
    const expiresIn = this.parseExpiration(accessTokenExpiration);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  /**
   * 保存刷新令牌到数据库
   */
  private async saveRefreshToken(
    userId: string,
    token: string,
    userAgent?: string,
    ip?: string,
  ): Promise<void> {
    const refreshTokenExpiration = this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    );
    const expiresInMs = this.parseExpirationToMs(refreshTokenExpiration);

    // 先删除该用户之前的刷新令牌（单设备登录策略）
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
      },
    });

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt: new Date(Date.now() + expiresInMs),
        userAgent,
        ip,
      },
    });
  }

  /**
   * 从数据库配置读取访问令牌过期时间
   * 优先级：DB security.sessionTimeout > 环境变量 JWT_ACCESS_EXPIRATION > 默认 15m
   */
  private async getAccessTokenExpiration(): Promise<string> {
    try {
      const dbConfig = await this.prisma.config.findFirst({
        where: {
          key: 'security.sessionTimeout',
          deletedAt: null,
          isActive: true,
        },
      });
      if (dbConfig) {
        const seconds = parseInt(dbConfig.value, 10);
        if (!isNaN(seconds) && seconds > 0) {
          return `${seconds}s`;
        }
      }
    } catch (error) {
      this.logger.warn('读取数据库会话配置失败，回退到环境变量');
    }
    return this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m');
  }

  /**
   * 从数据库读取安全配置（数字类型）
   */
  private async getSecurityNumber(
    key: string,
    defaultValue: number,
  ): Promise<number> {
    try {
      const config = await this.prisma.config.findFirst({
        where: { key, deletedAt: null, isActive: true },
      });
      if (config) {
        const val = parseInt(config.value, 10);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch {
      this.logger.warn(`读取安全配置 ${key} 失败，使用默认值 ${defaultValue}`);
    }
    return defaultValue;
  }

  /**
   * 从数据库读取安全配置（布尔类型）
   */
  private async getSecurityBoolean(
    key: string,
    defaultValue: boolean,
  ): Promise<boolean> {
    try {
      const config = await this.prisma.config.findFirst({
        where: { key, deletedAt: null, isActive: true },
      });
      if (config) {
        return config.value === 'true' || config.value === '1';
      }
    } catch {
      this.logger.warn(`读取安全配置 ${key} 失败，使用默认值 ${defaultValue}`);
    }
    return defaultValue;
  }

  /**
   * 根据数据库安全配置动态验证密码策略
   */
  async validatePasswordPolicy(password: string): Promise<void> {
    const minLength = await this.getSecurityNumber(
      'security.passwordMinLength',
      8,
    );
    const requireUppercase = await this.getSecurityBoolean(
      'security.passwordRequireUppercase',
      false,
    );
    const requireNumber = await this.getSecurityBoolean(
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
   * 解析过期时间为秒数
   */
  private parseExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // 默认15分钟

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * (multipliers[unit] || 60);
  }

  /**
   * 解析过期时间为毫秒
   */
  private parseExpirationToMs(expiration: string): number {
    return this.parseExpiration(expiration) * 1000;
  }
}
