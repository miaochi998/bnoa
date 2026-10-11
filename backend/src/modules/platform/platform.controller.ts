import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Put,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  UserPayload,
} from '../../common/decorators/current-user.decorator';
import { PlatformService } from './platform.service';
import {
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';
import {
    CreatePlatformDto,
    UpdatePlatformDto,
    QueryPlatformDto,
} from './dto/platform.dto';

/**
 * 平台字段映射：用于「信息权限」的读取脱敏与写入过滤
 */
const PLATFORM_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'name', key: 'name' },
  { field: 'code', key: 'code' },
  { field: 'type', key: 'type' },
  { field: 'status', key: 'status' },
  { field: 'website', key: 'website' },
  { field: 'logo', key: 'logo' },
  { field: 'remark', key: 'remark' },
];

@ApiTags('平台管理')
@Controller('business/platforms')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PlatformController {
    constructor(
        private readonly platformService: PlatformService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'platform',
            user.roles ?? [],
        );
    }

    @Get()
    @Permissions('platform:view')
    async findAll(
        @Query() query: QueryPlatformDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.platformService.findAll(query);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: this.fieldPermissionService.stripHiddenFieldsForList(
                result.list,
                PLATFORM_FIELD_MAP,
                state,
            ),
        };
    }

    @Get('active')
    @Permissions('platform:view')
    async findActive(@CurrentUser() user: UserPayload) {
        const list = await this.platformService.findActive();
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            list as any[],
            PLATFORM_FIELD_MAP,
            state,
        );
    }

    @Get(':id')
    @Permissions('platform:view')
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const data = await this.platformService.findById(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFields(
            data,
            PLATFORM_FIELD_MAP,
            state,
        );
    }

    @Post()
    @Permissions('platform:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreatePlatformDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            PLATFORM_FIELD_MAP,
            state,
        );
        // 必填字段被「字段权限」剔除时给出明确提示，而不是让 Prisma 抛 500
        if (!(safe as any).name) {
            throw new ForbiddenException('没有「平台名称」的编辑权限，无法创建平台');
        }
        const created = await this.platformService.create(safe, user.sub);
        return this.fieldPermissionService.stripHiddenFields(
            created as any,
            PLATFORM_FIELD_MAP,
            state,
        );
    }

    @Patch(':id')
    @Permissions('platform:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdatePlatformDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            PLATFORM_FIELD_MAP,
            state,
        );
        const updated = await this.platformService.update(id, safe, user.sub);
        // 写响应与读接口一致地脱敏，否则可借「改一个可编辑字段」读回被隐藏字段
        return this.fieldPermissionService.stripHiddenFields(
            updated as any,
            PLATFORM_FIELD_MAP,
            state,
        );
    }

    @Delete(':id')
    @Permissions('platform:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.platformService.delete(id, userId);
    }

    @Put('reorder')
    @Permissions('platform:update')
    @HttpCode(HttpStatus.OK)
    async reorder(@Body() body: { ids: string[] }) {
        return this.platformService.reorderPlatforms(body.ids);
    }
}
