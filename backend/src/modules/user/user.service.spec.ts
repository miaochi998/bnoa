import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../config/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    userRole: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    _prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应该成功创建用户', async () => {
      const input = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      };

      // 第一次调用检查用户名/邮箱是否存在
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);

      mockPrismaService.user.create.mockResolvedValue({
        id: '1',
        ...input,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [],
      });

      // 第二次调用获取完整用户信息
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: '1',
        ...input,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [],
      });

      const result = await service.create(input);

      expect(result).toBeDefined();
      expect(result.username).toBe(input.username);
      expect(result.email).toBe(input.email);
    });

    it('当用户名已存在时应该抛出 ConflictException', async () => {
      const input = {
        username: 'existinguser',
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      };

      mockPrismaService.user.findFirst.mockResolvedValue({
        id: '1',
        username: 'existinguser',
        email: 'existing@example.com',
      });

      await expect(service.create(input)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('应该根据ID找到用户', async () => {
      const userId = '1';
      const mockUser = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [{ role: { name: 'user' } }],
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findById(userId);

      expect(result).toBeDefined();
      expect(result.id).toBe(userId);
      expect(result.username).toBe(mockUser.username);
    });

    it('当用户不存在时应该抛出 NotFoundException', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.findById('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('应该成功更新用户', async () => {
      const userId = '1';
      const input = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      // 第一次调用检查用户是否存在
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        status: 'ACTIVE',
        userRoles: [],
      });

      // 检查邮箱是否被其他用户使用
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        ...input,
        username: 'testuser',
        status: 'ACTIVE',
        userRoles: [],
      });

      // 获取更新后的用户信息
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: userId,
        ...input,
        username: 'testuser',
        status: 'ACTIVE',
        userRoles: [],
      });

      const result = await service.update(userId, input);

      expect(result).toBeDefined();
      expect(result.name).toBe(input.name);
      expect(result.email).toBe(input.email);
    });
  });

  describe('delete', () => {
    it('应该成功删除用户', async () => {
      const userId = '1';

      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: userId,
        username: 'testuser',
      });

      mockPrismaService.userRole.findMany.mockResolvedValue([
        { role: { code: 'user' } },
      ]);

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        deletedAt: new Date(),
      });

      await expect(service.delete(userId)).resolves.not.toThrow();
    });

    it('当删除超级管理员时应该抛出 BadRequestException', async () => {
      const userId = '1';

      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: userId,
        username: 'admin',
      });

      mockPrismaService.userRole.findMany.mockResolvedValue([
        { role: { code: 'super_admin' } },
      ]);

      await expect(service.delete(userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('应该返回用户列表', async () => {
      const filter = {};
      const page = { page: 1, pageSize: 10 };

      mockPrismaService.user.findMany.mockResolvedValue([
        {
          id: '1',
          username: 'user1',
          email: 'user1@example.com',
          name: 'User 1',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          userRoles: [],
        },
      ]);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.findAll(filter, page);

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.page).toBe(1);
    });
  });
});
