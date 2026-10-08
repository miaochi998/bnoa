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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SaveVersionDto } from './dto/save-version.dto';
import { QueryVersionsDto } from './dto/query-versions.dto';

@ApiTags('内容版本管理')
@Controller('content-versions')
@UseGuards(JwtAuthGuard)
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
