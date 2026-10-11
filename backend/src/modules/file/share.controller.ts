import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    Res,
    UseGuards,
    StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { ShareService } from './share.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPayload } from '../../common/decorators/current-user.decorator';
import {
    FieldKeyMapping,
    FieldPermissionService,
} from '../role/field-permission.service';
import { CreateShareDto, AccessShareDto } from './dto/create-share.dto';

/**
 * 分享列表字段映射（分享记录里的分享码 / 文件大小等按「文件管理」模块的字段权限控制）
 */
const SHARE_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'shareCode', key: 'code' },
    { field: 'name', key: 'name' },
    { field: 'size', key: 'size' },
];

/**
 * 文件分享控制器
 */
@ApiTags('文件分享')
@Controller('shares')
export class ShareController {
    constructor(
        private readonly shareService: ShareService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /**
     * 创建分享
     */
    @Post()
    // 必须同时挂 PermissionGuard，否则 @Permissions 装饰器不生效
    @UseGuards(JwtAuthGuard, PermissionGuard)
    @Permissions('file:share')
    @ApiBearerAuth()
    @ApiOperation({ summary: '创建分享' })
    async create(
        @Body() dto: CreateShareDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.shareService.create(dto, userId);
    }

    /**
     * 获取我的分享列表（必须在 :code 路由之前）
     */
    @Get('my/list')
    @UseGuards(JwtAuthGuard, PermissionGuard)
    @Permissions('file:list')
    @ApiBearerAuth()
    @ApiOperation({ summary: '获取我的分享列表' })
    async findByUser(@CurrentUser() user: UserPayload) {
        const userId = user.userId ?? user.sub;
        const list = await this.shareService.findByUser(userId);
        // 分享码 / 文件大小等同样受「文件管理」的字段权限约束（原先完全未脱敏）
        const state = await this.fieldPermissionService.resolve(
            user.sub,
            'file',
            user.roles ?? [],
        );
        return this.fieldPermissionService.stripHiddenFieldsDeep(
            list,
            SHARE_FIELD_MAP,
            state,
        );
    }

    /**
     * 获取分享基础信息（公开，无需登录）
     */
    @Get(':code/info')
    @ApiOperation({ summary: '获取分享基础信息' })
    async getShareInfo(@Param('code') code: string) {
        return this.shareService.getShareInfo(code);
    }

    /**
     * 代理分享文件内容（公开，无需登录）
     */
    @Get(':code/file')
    @ApiOperation({ summary: '获取分享文件内容' })
    async getFile(
        @Param('code') code: string,
        @Query('download') download: string,
        @Query('password') password: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        const { buffer, fileName, mimeType, size } =
            await this.shareService.getFileBuffer(
                code,
                password,
                download === '1',
            );

        const disposition = download === '1'
            ? `attachment; filename="${encodeURIComponent(fileName)}"`
            : `inline; filename="${encodeURIComponent(fileName)}"`;

        res.set({
            'Content-Type': mimeType,
            'Content-Disposition': disposition,
            'Content-Length': size.toString(),
            'Cache-Control': 'public, max-age=3600',
        });

        return new StreamableFile(buffer);
    }

    /**
     * 访问分享（公开，验证密码后获取文件 URL）
     */
    @Post(':code/access')
    @ApiOperation({ summary: '访问分享' })
    async accessShare(
        @Param('code') code: string,
        @Body() dto: AccessShareDto,
    ) {
        return this.shareService.accessShare(code, dto.password);
    }

    /**
     * 取消分享
     */
    @Delete(':fileId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '取消分享' })
    async cancel(
        @Param('fileId') fileId: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.shareService.cancel(fileId, userId);
        return { success: true, message: '分享已取消' };
    }
}
