import {
    Injectable,
    Logger,
    OnModuleInit,
    OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private client: Redis;

    constructor(private readonly configService: ConfigService) {}

    async onModuleInit(): Promise<void> {
        const host = this.configService.get<string>(
            'REDIS_HOST',
            'localhost',
        );
        const port = this.configService.get<number>('REDIS_PORT', 6382);
        const password = this.configService.get<string>(
            'REDIS_PASSWORD',
            '',
        );
        const db = this.configService.get<number>('REDIS_DB', 0);

        this.client = new Redis({
            host,
            port,
            password: password || undefined,
            db,
            retryStrategy: (times: number) => {
                if (times > 3) {
                    this.logger.error(
                        `Redis 连接失败，已重试 ${times} 次`,
                    );
                    return null;
                }
                return Math.min(times * 200, 2000);
            },
        });

        this.client.on('connect', () => {
            this.logger.log(
                `Redis 已连接: ${host}:${port} DB:${db}`,
            );
        });

        this.client.on('error', (err: Error) => {
            this.logger.error(`Redis 连接错误: ${err.message}`);
        });
    }

    async onModuleDestroy(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.logger.log('Redis 连接已关闭');
        }
    }

    async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    async set(
        key: string,
        value: string,
        ttlSeconds?: number,
    ): Promise<void> {
        if (ttlSeconds) {
            await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
            await this.client.set(key, value);
        }
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async exists(key: string): Promise<boolean> {
        const result = await this.client.exists(key);
        return result === 1;
    }

    async setNX(
        key: string,
        value: string,
        ttlSeconds?: number,
    ): Promise<boolean> {
        if (ttlSeconds) {
            const result = await this.client.set(
                key,
                value,
                'EX',
                ttlSeconds,
                'NX',
            );
            return result === 'OK';
        } else {
            const result = await this.client.setnx(key, value);
            return result === 1;
        }
    }
}
