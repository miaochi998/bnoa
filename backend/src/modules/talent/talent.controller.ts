import {
    Controller,
    Get,
    Post,
    Patch,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TalentService } from './talent.service';
import {
    CreateTalentDto,
    UpdateTalentDto,
    TalentQueryDto,
} from './dto/talent.dto';
import {
    CreateTalentPlatformDto,
    UpdateTalentPlatformDto,
} from './dto/talent-platform.dto';
import {
    CreateTalentContactLogDto,
    TalentContactLogQueryDto,
} from './dto/talent-contact-log.dto';
import {
    SetTalentFlagDto,
    SaveFlagConfigsDto,
} from './dto/talent-flag.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
    CurrentUser,
    UserPayload,
} from '../../common/decorators/current-user.decorator';
import {
    FieldKeyMapping,
    FieldPermissionService,
    FieldPermissionState,
} from '../role/field-permission.service';

/**
 * 达人字段映射：用于「信息权限」的读取脱敏与写入过滤
 * ⚠️ 平台账号与沟通记录挂在数组里，数组项字段名是 nickname / accountId / homeUrl / content；
 *    平台数组在接口里叫 platforms（数据库关系名 talentPlatforms）。
 * ⚠️ 标旗：数据库关系名 talentFlags，service 里改名为 `flags`，元素属性名 flagColor。
 */
const TALENT_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'name', key: 'name' },
    { field: 'status', key: 'status' },
    { field: 'level', key: 'level' },
    { field: 'managerId', key: 'managerId' },
    { field: 'remark', key: 'remark' },
    { field: 'wechat', key: 'wechat' },
    { field: 'phone', key: 'phone' },
    { field: 'platform.nickname', key: 'nickname' },
    { field: 'platform.accountId', key: 'accountId' },
    { field: 'platform.homeUrl', key: 'homeUrl' },
    { field: 'contactLog.content', key: 'content' },
    // 标旗记录（flags[] 的每个元素）
    { field: 'flag.flagColor', key: 'flagColor' },
];

/**
 * 标旗含义配置：含义存在 `talent_flag_configs`，数组元素属性名 meaning。
 * 单独一张映射，避免与 `flag.flagColor` 互相牵连
 * （flagColor 是配置行的维度键，隐藏颜色不应把配置行变成无名记录）。
 */
const TALENT_FLAG_CONFIG_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'flagConfig.meaning', key: 'meaning' },
];

/** 需要递归处理的数组字段名（关系名 / 返回名 / 分页 list 三套都要覆盖） */
const TALENT_NESTED_ARRAYS = [
    'talentPlatforms',
    'platforms',
    'talentContactLogs',
    'contactLogs',
    'list',
    // 标旗数组（service 里 talentFlags → flags）
    'flags',
];

@ApiTags('达人管理')
@ApiBearerAuth()
@Controller('business/talents')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TalentController {
    constructor(
        private readonly talentService: TalentService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'talent',
            user.roles ?? [],
        );
    }

    /** 达人（含平台账号数组、沟通记录数组）的读脱敏 */
    private stripTalentDeep(node: any, state: FieldPermissionState): any {
      return this.fieldPermissionService.stripHiddenFieldsDeep(
        node,
        TALENT_FIELD_MAP,
        state,
      );
    }

    /** 写过滤：剔除请求体里不可编辑的字段 */
    private stripUneditable(dto: any, state: FieldPermissionState): any {
        return this.fieldPermissionService.stripUneditableFields(
            dto ?? {},
            TALENT_FIELD_MAP,
            state,
        );
    }

    // ========== 静态路由（必须在 :id 前） ==========

    @Post()
    @Permissions('talent:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateTalentDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditable(dto, state) as CreateTalentDto;
        if (!safe.name) {
            throw new ForbiddenException('没有「达人名称」的编辑权限');
        }
        return this.talentService.create(safe, user.sub);
    }

    @Get('select/list')
    @Permissions('talent:view')
    async findAllForSelect(
        @CurrentUser() user: UserPayload,
    ) {
        const list = await this.talentService.findAllForSelect(
            user.userId!, user.roles,
        );
        const state = await this.resolveFields(user);
        // 下拉同样按字段权限处理（达人含微信号/手机号等敏感字段）
        return this.stripTalentDeep(list, state);
    }

    @Get('flag-configs')
    @Permissions('talent:view')
    async getFlagConfigs(
        @CurrentUser() user: UserPayload,
    ) {
        const list = await this.talentService.getFlagConfigs(user.userId!);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            list as any[],
            TALENT_FLAG_CONFIG_FIELD_MAP,
            state,
        );
    }

    @Put('flag-configs')
    @Permissions('talent:flag')
    @HttpCode(HttpStatus.OK)
    async saveFlagConfigs(
        @Body() dto: SaveFlagConfigsDto,
        @CurrentUser() user: UserPayload,
    ) {
        const list = await this.talentService.saveFlagConfigs(
            dto, user.userId!,
        );
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            list as any[],
            TALENT_FLAG_CONFIG_FIELD_MAP,
            state,
        );
    }

    @Patch('platforms/:id')
    @Permissions('talent:update')
    @HttpCode(HttpStatus.OK)
    async updatePlatform(
        @Param('id') id: string,
        @Body() dto: UpdateTalentPlatformDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditable(dto, state);
        return this.talentService.updatePlatform(
            id, safe as UpdateTalentPlatformDto, user.userId!, user.roles,
        );
    }

    @Delete('platforms/:id')
    @Permissions('talent:delete')
    @HttpCode(HttpStatus.OK)
    async deletePlatform(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.deletePlatform(
            id, user.userId!, user.roles,
        );
    }

    @Get()
    @Permissions('talent:view')
    async findAll(
        @Query() query: TalentQueryDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.talentService.findAll(
            query, user.userId!, user.roles,
        );
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: (result.list || []).map((t: any) =>
                this.stripTalentDeep(t, state),
            ),
        };
    }

    // ========== 参数化路由 ==========

    @Get(':id')
    @Permissions('talent:view')
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const talent = await this.talentService.findById(
            id, user.userId!, user.roles,
        );
        const state = await this.resolveFields(user);
        return this.stripTalentDeep(talent, state);
    }

    @Patch(':id')
    @Permissions('talent:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateTalentDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditable(dto, state);
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有达人字段的编辑权限');
        }
        return this.talentService.update(
            id, safe as UpdateTalentDto, user.userId!, user.roles,
        );
    }

    @Delete(':id')
    @Permissions('talent:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.delete(
            id, user.userId!, user.roles,
        );
    }

    // ========== 平台账号子路由 ==========

    @Post(':talentId/platforms')
    @Permissions('talent:create')
    @HttpCode(HttpStatus.OK)
    async createPlatform(
        @Param('talentId') talentId: string,
        @Body() dto: CreateTalentPlatformDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditable(dto, state);
        return this.talentService.createPlatform(
            talentId, safe as CreateTalentPlatformDto, user.userId!, user.roles,
        );
    }

    @Get(':talentId/platforms')
    @Permissions('talent:view')
    async findPlatformsByTalent(
        @Param('talentId') talentId: string,
        @CurrentUser() user: UserPayload,
    ) {
        const talent = await this.talentService.findById(
            talentId, user.userId!, user.roles,
        );
        const state = await this.resolveFields(user);
        const list = (talent as any).platforms ?? [];
        return list.map((p: any) => this.stripTalentDeep(p, state));
    }

    // ========== 沟通记录子路由 ==========

    @Post(':talentId/contact-logs')
    @Permissions('talent:contact-add')
    @HttpCode(HttpStatus.OK)
    async createContactLog(
        @Param('talentId') talentId: string,
        @Body() dto: CreateTalentContactLogDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditable(dto, state) as CreateTalentContactLogDto;
        if (!safe.content) {
            throw new ForbiddenException('没有「沟通记录内容」的编辑权限');
        }
        return this.talentService.createContactLog(
            talentId, safe, user.userId!, user.roles,
        );
    }

    @Get(':talentId/contact-logs')
    @Permissions('talent:view')
    async findContactLogs(
        @Param('talentId') talentId: string,
        @Query() query: TalentContactLogQueryDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.talentService.findContactLogs(
            talentId, query, user.userId!, user.roles,
        );
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: (result.list || []).map((log: any) =>
                this.stripTalentDeep(log, state),
            ),
        };
    }

    // ========== 标旗子路由 ==========

    @Post(':id/flag')
    @Permissions('talent:flag')
    @HttpCode(HttpStatus.OK)
    async setFlag(
        @Param('id') id: string,
        @Body() dto: SetTalentFlagDto,
        @CurrentUser() user: UserPayload,
    ) {
        const record = await this.talentService.setFlag(
            id, dto, user.userId!, user.roles,
        );
        const state = await this.resolveFields(user);
        // 返回的是标旗记录（含 flagColor），按「标记颜色」字段权限脱敏
        return this.fieldPermissionService.stripHiddenFields(
            record as any,
            TALENT_FIELD_MAP,
            state,
        );
    }

    @Delete(':id/flag')
    @Permissions('talent:flag')
    @HttpCode(HttpStatus.OK)
    async removeFlag(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.talentService.removeFlag(
            id, user.userId!, user.roles,
        );
    }
}
