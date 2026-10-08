import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    UseInterceptors,
    UploadedFiles,
    BadRequestException,
    Res,
    NotFoundException,
    StreamableFile,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CaptchaService } from './captcha.service';
import { CaptchaBackgroundService } from './captcha-background.service';
import { UpdateCaptchaConfigDto } from './dto/update-captcha-config.dto';
import {
    CreateBackgroundDto,
    UpdateBackgroundDto,
    BatchDeleteDto,
    BatchCreateBackgroundDto,
} from './dto/create-background.dto';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('验证码管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('captcha-settings')
export class CaptchaSettingsController {
    constructor(
        private readonly captchaService: CaptchaService,
        private readonly bgService: CaptchaBackgroundService,
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
        private readonly localStorageService: LocalStorageService,
    ) {}

    @Get('config')
    @ApiOperation({ summary: '获取完整验证码配置' })
    async getConfig() {
        const configs =
            await this.prisma.systemConfig.findMany({
                where: { group: 'captcha' },
            });
        const map = new Map(
            configs.map((c) => [c.key, c.value]),
        );
        const data = {
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
                map.get('captcha.enableTrailVerify') !==
                'false',
            loginRequired:
                map.get('captcha.loginRequired') !==
                'false',
            registerRequired:
                map.get('captcha.registerRequired') !==
                'false',
            resetPasswordRequired:
                map.get(
                    'captcha.resetPasswordRequired',
                ) !== 'false',
            maxBackgrounds: parseInt(
                map.get('captcha.maxBackgrounds') ||
                    '100',
                10,
            ),
            minBackgrounds: parseInt(
                map.get('captcha.minBackgrounds') || '5',
                10,
            ),
            backgroundFolderId:
                map.get('captcha.backgroundFolderId') ||
                '',
            storageMode:
                map.get('captcha.storageMode') ||
                'rustfs',
        };
        return { code: 200, message: '获取成功', data };
    }

    @Patch('config')
    @ApiOperation({ summary: '更新验证码配置' })
    async updateConfig(
        @Body() dto: UpdateCaptchaConfigDto,
    ) {
        const fieldMap: Record<string, string> = {
            enabled: 'captcha.enabled',
            type: 'captcha.type',
            expireTime: 'captcha.expireTime',
            tolerance: 'captcha.tolerance',
            maxAttempts: 'captcha.maxAttempts',
            enableTrailVerify:
                'captcha.enableTrailVerify',
            backgroundFolderId:
                'captcha.backgroundFolderId',
            loginRequired: 'captcha.loginRequired',
            registerRequired: 'captcha.registerRequired',
            resetPasswordRequired:
                'captcha.resetPasswordRequired',
            maxBackgrounds: 'captcha.maxBackgrounds',
            minBackgrounds: 'captcha.minBackgrounds',
            storageMode: 'captcha.storageMode',
        };

        for (const [field, configKey] of Object.entries(
            fieldMap,
        )) {
            const value = (dto as any)[field];
            if (value !== undefined) {
                await this.prisma.systemConfig.upsert({
                    where: { key: configKey },
                    update: { value: String(value) },
                    create: {
                        key: configKey,
                        value: String(value),
                        group: 'captcha',
                    },
                });
            }
        }
        return { code: 200, message: '配置更新成功' };
    }

    @Get('backgrounds')
    @ApiOperation({ summary: '获取背景图列表' })
    async getBackgrounds() {
        const list = await this.bgService.findAll();
        return {
            code: 200,
            message: '获取成功',
            data: { list },
        };
    }

    @Get('backgrounds/stats')
    @ApiOperation({ summary: '获取背景图统计' })
    async getBackgroundStats() {
        const data = await this.bgService.getStats();
        return { code: 200, message: '获取成功', data };
    }

    @Post('backgrounds')
    @ApiOperation({ summary: '上传单张背景图记录' })
    async createBackground(
        @Body() dto: CreateBackgroundDto,
        @CurrentUser('sub') userId: string,
    ) {
        const data = await this.bgService.create(
            dto,
            userId,
        );
        return {
            code: 200,
            message: '创建成功',
            data,
        };
    }

    @Post('backgrounds/batch')
    @ApiOperation({ summary: '批量上传背景图记录' })
    async batchCreateBackground(
        @Body() dto: BatchCreateBackgroundDto,
        @CurrentUser('sub') userId: string,
    ) {
        const data = await this.bgService.batchCreate(
            dto.items,
            userId,
        );
        return {
            code: 200,
            message: '批量创建成功',
            data,
        };
    }

    @Patch('backgrounds/:id')
    @ApiOperation({ summary: '更新背景图' })
    async updateBackground(
        @Param('id') id: string,
        @Body() dto: UpdateBackgroundDto,
    ) {
        const data = await this.bgService.update(
            id,
            dto,
        );
        return {
            code: 200,
            message: '更新成功',
            data,
        };
    }

    @Delete('backgrounds/:id')
    @ApiOperation({ summary: '删除单张背景图' })
    async deleteBackground(@Param('id') id: string) {
        await this.bgService.delete(id);
        return { code: 200, message: '删除成功' };
    }

    @Delete('backgrounds/batch')
    @ApiOperation({ summary: '批量删除背景图' })
    async batchDeleteBackground(
        @Body() dto: BatchDeleteDto,
    ) {
        const count = await this.bgService.batchDelete(
            dto.ids,
        );
        return {
            code: 200,
            message: `成功删除 ${count} 张`,
        };
    }

    @Patch('backgrounds/order')
    @ApiOperation({ summary: '更新背景图排序' })
    async updateBackgroundOrder(
        @Body()
        orders: { id: string; sortOrder: number }[],
    ) {
        await this.bgService.updateOrder(orders);
        return { code: 200, message: '排序更新成功' };
    }

    @Post('backgrounds/upload')
    @ApiOperation({ summary: '上传验证码背景图' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FilesInterceptor('files', 10))
    async uploadBackgrounds(
        @UploadedFiles() files: Express.Multer.File[],
        @Query('storageMode') queryMode: string,
        @CurrentUser('sub') userId: string,
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException(
                '请选择要上传的图片',
            );
        }

        // 读取配置中的存储方式和真实文件夹
        const configs =
            await this.prisma.systemConfig.findMany({
                where: { group: 'captcha' },
            });
        const cfgMap = new Map(
            configs.map((c) => [c.key, c.value]),
        );
        const mode =
            queryMode ||
            cfgMap.get('captcha.storageMode') ||
            'rustfs';
        const folderId = cfgMap.get(
            'captcha.backgroundFolderId',
        );

        // 查找真实文件夹路径
        let folderPath = 'captcha-backgrounds';
        if (folderId) {
            const realFolder =
                await this.prisma.realFolder.findUnique(
                    { where: { id: folderId } },
                );
            if (realFolder) {
                folderPath = realFolder.pathName;
            }
        }

        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
        ];
        const maxSize = 200 * 1024;
        const results = [];

        for (const file of files) {
            if (
                !allowedTypes.includes(file.mimetype)
            ) {
                continue;
            }
            if (file.size > maxSize) {
                continue;
            }

            const key = `${folderPath}/${Date.now()}-${file.originalname}`;
            let filePath: string;
            let storageType: string;

            if (mode === 'local') {
                filePath =
                    await this.localStorageService.uploadFile(
                        file.buffer,
                        key,
                    );
                storageType = 'LOCAL';
            } else {
                filePath =
                    await this.storageService.upload(
                        file.buffer,
                        key,
                        file.mimetype,
                    );
                storageType = 'RUSTFS';
            }

            const bg = await this.bgService.create(
                {
                    fileName: file.originalname,
                    filePath,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    storageType,
                    folderId: folderId || undefined,
                },
                userId,
            );
            results.push(bg);
        }

        return {
            code: 200,
            message: `成功上传 ${results.length} 张`,
            data: { list: results },
        };
    }

    @Post('backgrounds/sync-folder')
    @ApiOperation({
        summary: '从文件夹同步图片到背景图',
    })
    async syncFolderImages(
        @Body() body: { folderId: string },
        @CurrentUser('sub') userId: string,
    ) {
        if (!body.folderId) {
            throw new BadRequestException(
                '请选择文件夹',
            );
        }
        const data =
            await this.bgService.syncFromFolder(
                body.folderId,
                userId,
            );
        return {
            code: 200,
            message: `同步完成，新增 ${data.added} 张`,
            data,
        };
    }

    @Public()
    @Get('backgrounds/:id/image')
    @ApiOperation({ summary: '代理获取背景图图片' })
    async getBackgroundImage(
        @Param('id') id: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        const bg =
            await this.prisma.captchaBackground.findFirst(
                {
                    where: { id, deletedAt: null },
                },
            );
        if (!bg) {
            throw new NotFoundException(
                '背景图不存在',
            );
        }

        let buffer: Buffer;
        if (bg.storageType === 'LOCAL') {
            const fs = await import('fs');
            if (!fs.existsSync(bg.filePath)) {
                throw new NotFoundException(
                    '文件不存在',
                );
            }
            buffer = fs.readFileSync(bg.filePath);
        } else {
            const url = new URL(bg.filePath);
            const pathParts =
                url.pathname.split('/');
            const bucketIdx = pathParts.findIndex(
                (p) => p.length > 0,
            );
            const key = pathParts
                .slice(bucketIdx + 1)
                .join('/');
            buffer =
                await this.storageService.download(
                    key,
                );
        }

        res.set({
            'Content-Type': bg.mimeType,
            'Cache-Control': 'public, max-age=86400',
        });
        return new StreamableFile(buffer);
    }
}
