import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    NotFoundException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { ContentVersionService } from './content-version.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SaveVersionDto } from './dto/save-version.dto';
import { QueryVersionsDto } from './dto/query-versions.dto';

/**
 * 内容版本管理（富文本编辑器的版本历史）
 *
 * 2026-10-12 补锁：此前只挂 JwtAuthGuard、无任何权限码，
 * 任意登录用户可对任意 contentId 读取 / 保存 / 恢复 / 删除版本。
 * 现统一要求 content-version:manage（上线前需先把该码授予现有角色，
 * 见迁移 20261012120000_permission_lockdown_and_cleanup）。
 */
@ApiTags('内容版本管理')
@Controller('content-versions')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ContentVersionController {
    constructor(
        private readonly service:
            ContentVersionService,
    ) {}

    /**
     * 保存版本
     */
    @Post(':contentType/:contentId')
    @Permissions('content-version:manage')
    @ApiOperation({ summary: '保存内容版本' })
    async saveVersion(
        @Param('contentType') contentType: string,
        @Param('contentId') contentId: string,
        @Body() dto: SaveVersionDto,
        @CurrentUser('userId') userId: string,
    ) {
        const version =
            await this.service.saveVersion(
                contentType,
                contentId,
                dto,
                userId,
            );
        return {
            code: 200,
            message: 'success',
            data: version,
        };
    }

    /**
     * 获取版本列表
     */
    @Get(':contentType/:contentId')
    @Permissions('content-version:manage')
    @ApiOperation({ summary: '获取版本列表' })
    async getVersions(
        @Param('contentType') contentType: string,
        @Param('contentId') contentId: string,
        @Query() query: QueryVersionsDto,
    ) {
        const result =
            await this.service.getVersions(
                contentType,
                contentId,
                query,
            );
        return {
            code: 200,
            message: 'success',
            data: result,
        };
    }

    /**
     * 获取版本详情
     */
    @Get(':contentType/:contentId/:versionId')
    @Permissions('content-version:manage')
    @ApiOperation({ summary: '获取版本详情' })
    async getVersionDetail(
        @Param('contentType') contentType: string,
        @Param('contentId') contentId: string,
        @Param('versionId') versionId: string,
    ) {
        const version =
            await this.service.getVersionDetail(
                contentType,
                contentId,
                versionId,
            );
        if (!version) {
            throw new NotFoundException(
                '版本不存在'
            );
        }
        return {
            code: 200,
            message: 'success',
            data: version,
        };
    }

    /**
     * 恢复版本
     */
    @Post(
        ':contentType/:contentId'
        + '/restore/:versionId'
    )
    @Permissions('content-version:manage')
    @ApiOperation({ summary: '恢复版本' })
    async restoreVersion(
        @Param('contentType') contentType: string,
        @Param('contentId') contentId: string,
        @Param('versionId') versionId: string,
        @CurrentUser('userId') userId: string,
    ) {
        const version =
            await this.service.restoreVersion(
                contentType,
                contentId,
                versionId,
                userId,
            );
        return {
            code: 200,
            message: 'success',
            data: version,
        };
    }

    /**
     * 删除版本
     */
    @Delete(
        ':contentType/:contentId/:versionId'
    )
    @Permissions('content-version:manage')
    @ApiOperation({ summary: '删除版本' })
    async deleteVersion(
        @Param('contentType') contentType: string,
        @Param('contentId') contentId: string,
        @Param('versionId') versionId: string,
    ) {
        await this.service.deleteVersion(
            contentType,
            contentId,
            versionId,
        );
        return {
            code: 200,
            message: 'success',
        };
    }
}
