import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../config/prisma.service';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// Mock PrismaService
const mockPrismaService = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

// Mock JwtService
const mockJwtService = {
  signAsync: jest.fn(),
};

// Mock ConfigService
const mockConfigService = {
  get: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: typeof mockPrismaService;
  let jwtService: typeof mockJwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'password123',
    };

    it('should successfully login with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        password: await CryptoUtil.hashPassword('password123'),
        name: 'Test User',
        avatar: null,
        status: 'ACTIVE',
        failedAttempts: 0,
        lockedUntil: null,
        userRoles: [{ role: { code: 'user' } }],
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });
      prisma.refreshToken.create.mockResolvedValue({});
      mockConfigService.get.mockReturnValue('15m');
      jwtService.signAsync.mockResolvedValue('mock-token');

      const result = await service.login(loginDto, '127.0.0.1', 'Mozilla/5.0');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.username).toBe('testuser');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login(loginDto, '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when account is locked', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        password: 'hashedpassword',
        status: 'ACTIVE',
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30分钟后
        failedAttempts: 5,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.login(loginDto, '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow('账户已锁定');
    });

    it('should throw ForbiddenException when account is inactive', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        password: 'hashedpassword',
        status: 'INACTIVE',
        lockedUntil: null,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.login(loginDto, '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow('账户已被禁用');
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'Password123!',
      name: 'New User',
    };

    it('should successfully register a new user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-123',
        username: registerDto.username,
        email: registerDto.email,
        name: registerDto.name,
        createdAt: new Date(),
      });

      const result = await service.register(registerDto);

      expect(result.username).toBe(registerDto.username);
      expect(result.email).toBe(registerDto.email);
    });

    it('should throw ConflictException when username already exists', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-123',
        username: 'newuser',
        email: 'other@example.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-123',
        username: 'otheruser',
        email: 'new@example.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      oldPassword: 'oldPassword123',
      newPassword: 'newPassword123!',
      confirmPassword: 'newPassword123!',
    };

    it('should successfully change password', async () => {
      const mockUser = {
        id: 'user-123',
        password: await CryptoUtil.hashPassword('oldPassword123'),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        password: 'newhashedpassword',
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.changePassword('user-123', changePasswordDto),
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException when passwords do not match', async () => {
      const dto = {
        ...changePasswordDto,
        confirmPassword: 'differentPassword',
      };

      await expect(service.changePassword('user-123', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when old password is incorrect', async () => {
      const mockUser = {
        id: 'user-123',
        password: await CryptoUtil.hashPassword('differentPassword'),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.changePassword('user-123', changePasswordDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh tokens', async () => {
      const mockTokenRecord = {
        id: 'token-123',
        token: 'old-refresh-token',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        userId: 'user-123',
        user: {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          status: 'ACTIVE',
        },
        userAgent: 'Mozilla/5.0',
        ip: '127.0.0.1',
      };

      prisma.refreshToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.refreshToken.update.mockResolvedValue({
        ...mockTokenRecord,
        isRevoked: true,
      });
      prisma.refreshToken.create.mockResolvedValue({});
      mockConfigService.get.mockReturnValue('15m');
      jwtService.signAsync.mockResolvedValue('new-mock-token');

      const result = await service.refreshToken({
        refreshToken: 'old-refresh-token',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException when token is revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        token: 'revoked-token',
        isRevoked: true,
      });

      await expect(
        service.refreshToken({ refreshToken: 'revoked-token' }),
      ).rejects.toThrow('刷新令牌已被撤销');
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        token: 'expired-token',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      await expect(
        service.refreshToken({ refreshToken: 'expired-token' }),
      ).rejects.toThrow('刷新令牌已过期');
    });
  });

  describe('logout', () => {
    it('should successfully logout and revoke token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.logout('user-123', 'refresh-token'),
      ).resolves.not.toThrow();
    });

    it('should revoke all tokens when no specific token provided', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await expect(service.logout('user-123')).resolves.not.toThrow();
    });
  });
});
