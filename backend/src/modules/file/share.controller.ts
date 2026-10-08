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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateShareDto, AccessShareDto } from './dto/create-share.dto';

/**
 * 文件分享控制器
 */
@ApiTags('文件分享')
@Controller('shares')
export class ShareController {
    constructor(private readonly shareService: ShareService) {}

    /**
     * 创建分享
     */
    @Post()
    @UseGuards(JwtAuthGuard)
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
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '获取我的分享列表' })
    async findByUser(@CurrentUser('userId') userId: string) {
        return this.shareService.findByUser(userId);
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
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        const { buffer, fileName, mimeType, size } =
            await this.shareService.getFileBuffer(code);

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
