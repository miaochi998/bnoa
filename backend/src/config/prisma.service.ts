import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
// Prisma v6 的类型导出与 moduleResolution:"node" 不完全兼容，
// 从 .prisma/client 直接导入类型可确保完整的模型访问器类型
import type { PrismaClient } from '.prisma/client';

// 通过 require() 获取运行时类，再用类型断言保证类型安全
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient: PrismaClientBase } = require('@prisma/client');

const BasePrismaService: new (options?: any) => PrismaClient =
  PrismaClientBase;

@Injectable()
export class PrismaService
  extends BasePrismaService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma Client connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma Client disconnected');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    // 清理所有表数据（仅用于测试）
    await this
      .$executeRaw`TRUNCATE TABLE users, roles, permissions, files, folders CASCADE;`;
  }
}
