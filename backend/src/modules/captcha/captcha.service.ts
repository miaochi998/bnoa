import {
    Injectable,
    Logger,
    OnModuleInit,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { StorageService } from '../storage/storage.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

@Injectable()
export class CaptchaService implements OnModuleInit {
    private readonly logger = new Logger(CaptchaService.name);
    private createPuzzle: any = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly storageService: StorageService,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.loadPuzzleModule();
        await this.initDefaultConfig();
    }

    private async loadPuzzleModule(): Promise<void> {
        try {
            const dynamicImport = new Function(
                'specifier',
                'return import(specifier)',
            );
            const module = await dynamicImport('node-puzzle');
            this.createPuzzle = module.default || module;
            this.logger.log('node-puzzle 模块加载成功');
        } catch (err) {
            this.logger.error(
                `node-puzzle 模块加载失败: ${err.message}`,
            );
        }
    }

    private async initDefaultConfig(): Promise<void> {
        const defaults: Record<string, string> = {
            'captcha.enabled': 'false',
            'captcha.type': 'slider',
            'captcha.expireTime': '300',
            'captcha.tolerance': '5',
            'captcha.maxAttempts': '3',
            'captcha.enableTrailVerify': 'true',
            'captcha.loginRequired': 'false',
            'captcha.registerRequired': 'false',
            'captcha.resetPasswordRequired': 'false',
            'captcha.maxBackgrounds': '100',
            'captcha.minBackgrounds': '5',
            'captcha.backgroundFolderId': '',
        };
        // 强制关闭验证码的键（已存在时也更新）
        const forceUpdateKeys = [
            'captcha.enabled',
            'captcha.loginRequired',
            'captcha.registerRequired',
            'captcha.resetPasswordRequired',
        ];
        for (const [key, value] of Object.entries(defaults)) {
            const existing =
                await this.prisma.systemConfig.findFirst({
                    where: { key },
                });
            if (!existing) {
                await this.prisma.systemConfig.create({
                    data: { key, value, group: 'captcha' },
                });
            } else if (forceUpdateKeys.includes(key)) {
                await this.prisma.systemConfig.update({
                    where: { key },
                    data: { value },
                });
            }
        }
        this.logger.log('验证码默认配置已初始化');
    }

    private async getInternalConfig(): Promise<{
        expireTime: number;
        tolerance: number;
        maxAttempts: number;
        enableTrailVerify: boolean;
    }> {
        const configs =
            await this.prisma.systemConfig.findMany({
                where: {
                    key: {
                        in: [
                            'captcha.expireTime',
                            'captcha.tolerance',
                            'captcha.maxAttempts',
                            'captcha.enableTrailVerify',
                        ],
                    },
                },
            });
        const map = new Map(
            configs.map((c) => [c.key, c.value]),
        );
        return {
            expireTime: parseInt(
                map.get('captcha.expireTime') || '300',
                10,
            ),
            tolerance: parseInt(
                map.get('captcha.tolerance') || '5',
                10,
            ),
            maxAttempts: parseInt(
                map.get('captcha.maxAttempts') || '3',
                10,
            ),
            enableTrailVerify:
                map.get('captcha.enableTrailVerify') !== 'false',
        };
    }

    async getFullConfig(): Promise<{
        enabled: boolean;
        type: string;
        expireTime: number;
        tolerance: number;
        maxAttempts: number;
        enableTrailVerify: boolean;
        loginRequired: boolean;
        registerRequired: boolean;
        resetPasswordRequired: boolean;
    }> {
        const configs =
            await this.prisma.systemConfig.findMany({
                where: { group: 'captcha' },
            });
        const map = new Map(
            configs.map((c) => [c.key, c.value]),
        );
        return {
            enabled:
                map.get('captcha.enabled') !== 'false',
            type: map.get('captcha.type') || 'slider',
            expireTime: parseInt(
                map.get('captcha.expireTime') || '300',
                10,
            ),
            tolerance: parseInt(
                map.get('captcha.tolerance') || '5',
                10,
            ),
            maxAttempts: parseInt(
                map.get('captcha.maxAttempts') || '3',
                10,
            ),
            enableTrailVerify:
                map.get('captcha.enableTrailVerify') !== 'false',
            loginRequired:
                map.get('captcha.loginRequired') !== 'false',
            registerRequired:
                map.get('captcha.registerRequired') !== 'false',
            resetPasswordRequired:
                map.get('captcha.resetPasswordRequired') !==
                'false',
        };
    }

    async generateCaptcha(): Promise<{
        id: string;
        bgUrl: string;
        puzzleUrl: string;
    }> {
        if (!this.createPuzzle) {
            throw new BadRequestException(
                '验证码服务未就绪，请稍后重试',
            );
        }

        const bgImagePath =
            await this.getBackgroundImage();
        const config = await this.getInternalConfig();

        const result = await this.createPuzzle(
            bgImagePath,
            {
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.8)',
                fillColor: 'rgba(255,255,255,0.6)',
                width: 60,
                height: 60,
                equalHeight: true,
            },
        );

        const captchaId = uuidv4();
        const captchaData = {
            x: result.x,
            y: result.y,
            tolerance: config.tolerance,
            enableTrailVerify: config.enableTrailVerify,
            maxAttempts: config.maxAttempts,
            attempts: 0,
        };

        await this.redis.set(
            `captcha:${captchaId}`,
            JSON.stringify(captchaData),
            config.expireTime,
        );

        const bgBase64 = `data:image/jpeg;base64,${result.bg.toString('base64')}`;
        const puzzleBase64 = `data:image/png;base64,${result.puzzle.toString('base64')}`;

        return {
            id: captchaId,
            bgUrl: bgBase64,
            puzzleUrl: puzzleBase64,
        };
    }

    async verifyCaptcha(
        captchaId: string,
        x: number,
        trail?: { x: number[]; y: number[] },
    ): Promise<{
        success: boolean;
        token?: string;
        message: string;
    }> {
        const raw = await this.redis.get(
            `captcha:${captchaId}`,
        );
        if (!raw) {
            return {
                success: false,
                message: '验证码已过期，请刷新重试',
            };
        }

        const data = JSON.parse(raw);
        const diff = Math.abs(x - data.x);

        if (diff > data.tolerance) {
            data.attempts = (data.attempts || 0) + 1;
            if (data.attempts >= data.maxAttempts) {
                await this.redis.del(
                    `captcha:${captchaId}`,
                );
                return {
                    success: false,
                    message:
                        '尝试次数过多，请刷新验证码',
                };
            }
            const config =
                await this.getInternalConfig();
            await this.redis.set(
                `captcha:${captchaId}`,
                JSON.stringify(data),
                config.expireTime,
            );
            return {
                success: false,
                message: '验证失败，请重试',
            };
        }

        if (data.enableTrailVerify && trail) {
            if (!this.validateTrail(trail)) {
                return {
                    success: false,
                    message: '验证失败，请重试',
                };
            }
        }

        await this.redis.del(`captcha:${captchaId}`);

        const token = uuidv4();
        const tokenData = {
            captchaId,
            verifiedAt: Date.now(),
        };
        await this.redis.set(
            `captcha:token:${token}`,
            JSON.stringify(tokenData),
            300,
        );

        return {
            success: true,
            token,
            message: '验证成功',
        };
    }

    async verifyToken(token: string): Promise<boolean> {
        const key = `captcha:token:${token}`;
        const exists = await this.redis.exists(key);
        if (exists) {
            await this.redis.del(key);
            return true;
        }
        return false;
    }

    private validateTrail(trail: {
        x: number[];
        y: number[];
    }): boolean {
        if (!trail.x || trail.x.length < 5) {
            return false;
        }
        let hasForward = false;
        for (let i = 1; i < trail.x.length; i++) {
            if (trail.x[i] > trail.x[i - 1]) {
                hasForward = true;
                break;
            }
        }
        if (!hasForward) {
            return false;
        }
        const uniqueX = new Set(trail.x);
        if (uniqueX.size < 3) {
            return false;
        }
        return true;
    }

    private async getBackgroundImage(): Promise<string> {
        const dbBg = await this.getRandomBgFromDb();
        if (dbBg) {
            return dbBg;
        }
        return this.getRandomLocalBg();
    }

    private async getRandomBgFromDb(): Promise<
        string | null
    > {
        const count =
            await this.prisma.captchaBackground.count({
                where: {
                    isEnabled: true,
                    deletedAt: null,
                },
            });
        if (count === 0) {
            return null;
        }
        const skip = Math.floor(Math.random() * count);
        const bg =
            await this.prisma.captchaBackground.findFirst({
                where: {
                    isEnabled: true,
                    deletedAt: null,
                },
                skip,
            });
        if (!bg) return null;

        if (bg.storageType === 'LOCAL') {
            return fs.existsSync(bg.filePath)
                ? bg.filePath
                : null;
        }

        // RUSTFS: 下载到临时文件
        try {
            const url = new URL(bg.filePath);
            const pathParts =
                url.pathname.split('/');
            const bucketIdx = pathParts.findIndex(
                (p) => p.length > 0,
            );
            const key = pathParts
                .slice(bucketIdx + 1)
                .join('/');
            const buffer =
                await this.storageService.download(
                    key,
                );
            const ext = path.extname(bg.fileName) || '.jpg';
            const tmpFile = path.join(
                os.tmpdir(),
                `captcha-bg-${Date.now()}${ext}`,
            );
            fs.writeFileSync(tmpFile, buffer);
            return tmpFile;
        } catch (err) {
            this.logger.error(
                `下载RUSTFS背景图失败: ${err.message}`,
            );
            return null;
        }
    }

    private getRandomLocalBg(): string {
        const dir = path.join(
            __dirname,
            '../../assets/captcha-backgrounds',
        );
        if (!fs.existsSync(dir)) {
            return 'https://picsum.photos/320/160';
        }
        const files = fs
            .readdirSync(dir)
            .filter(
                (f) =>
                    f.endsWith('.jpg') ||
                    f.endsWith('.png'),
            );
        if (files.length === 0) {
            return 'https://picsum.photos/320/160';
        }
        const randomFile =
            files[Math.floor(Math.random() * files.length)];
        return path.join(dir, randomFile);
    }
}
