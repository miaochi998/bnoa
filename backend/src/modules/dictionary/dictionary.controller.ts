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
    HttpCode,
    HttpStatus,
    ForbiddenException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../common/decorators/current-user.decorator';
import {
    FieldKeyMapping,
    FieldPermissionService,
} from '../role/field-permission.service';

/** 数据字典字段映射：用于「信息权限」的读取脱敏与写入过滤 */
const DICTIONARY_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'typeCode', key: 'typeCode' },
    { field: 'typeName', key: 'typeName' },
    { field: 'itemCode', key: 'itemCode' },
    { field: 'itemName', key: 'itemName' },
    { field: 'itemValue', key: 'itemValue' },
    { field: 'description', key: 'description' },
    { field: 'isDefault', key: 'isDefault' },
    { field: 'isActive', key: 'isActive' },
];
import { DictionaryService } from './dictionary.service';
import {
    CreateDictionaryDto,
    UpdateDictionaryDto,
    QueryDictionaryDto,
} from './dto/dictionary.dto';

@ApiTags('dictionaries')
@Controller('dictionaries')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class DictionaryController {
    constructor(
        private readonly dictionaryService: DictionaryService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'dictionary',
            user.roles ?? [],
        );
    }

    /** 递归脱敏（字典对象 / 数组 / 分类对象都兼容） */
    private stripDictDeep(node: any, state: any): any {
      return this.fieldPermissionService.stripHiddenFieldsDeep(
        node,
        DICTIONARY_FIELD_MAP,
        state,
      );
    }

    /**
     * 获取字典类型列表
     */
    @Get()
    @Permissions('dictionary:manage')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取字典类型列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getTypes(@CurrentUser() user: UserPayload) {
        const types = await this.dictionaryService.getTypes();
        const state = await this.resolveFields(user);
        return {
            success: true,
            message: '获取字典类型列表成功',
            data: this.stripDictDeep(types, state),
        };
    }

    /**
     * 按 typeCode 获取条目列表
     */
    @Get('items')
    @Permissions('dictionary:manage')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取字典条目列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getItems(
        @Query() query: QueryDictionaryDto,
        @CurrentUser() user: UserPayload,
    ) {
        if (query.typeCode) {
            const items =
                await this.dictionaryService.getItemsByType(
                    query.typeCode,
                );
            const state = await this.resolveFields(user);
            return {
                success: true,
                message: '获取字典条目成功',
                data: this.stripDictDeep(items, state),
            };
        }
        return {
            success: true,
            message: '请提供 typeCode',
            data: [],
        };
    }

    /**
     * 批量获取字典条目（公开接口）
     */
    @Get('batch')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量获取字典条目' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getBatch(@Query('typeCodes') typeCodes: string) {
        if (!typeCodes) {
            return {
                success: true,
                message: '请提供 typeCodes',
                data: {},
            };
        }
        const codes = typeCodes
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);
        const data =
            await this.dictionaryService.getItemsByTypes(codes);
        return {
            success: true,
            message: '批量获取字典条目成功',
            data,
        };
    }

    /**
     * 创建字典条目
     */
    @Post()
    @Permissions('dictionary:create')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: '创建字典条目' })
    @ApiResponse({ status: 201, description: '创建成功' })
    async create(
        @Body() dto: CreateDictionaryDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        // 写过滤：被配成「只读」的字段即使请求里传了也不生效
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            DICTIONARY_FIELD_MAP,
            state,
        );
        if (
            !safe.typeCode ||
            !safe.typeName ||
            !safe.itemCode ||
            !safe.itemName ||
            !safe.itemValue
        ) {
            throw new ForbiddenException(
                '创建字典条目所需的必填字段没有编辑权限',
            );
        }
        const item = await this.dictionaryService.create(safe);
        return {
            success: true,
            message: '字典条目创建成功',
            // 写响应与读接口一致地脱敏，避免回显隐藏字段
            data: this.stripDictDeep(item, state),
        };
    }

    /**
     * 更新字典条目
     */
    @Patch(':id')
    @Permissions('dictionary:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新字典条目' })
    @ApiResponse({ status: 200, description: '更新成功' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateDictionaryDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        // 写过滤：被配成「只读」的字段即使请求里传了也不生效
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            DICTIONARY_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有可编辑字段的权限');
        }
        const item = await this.dictionaryService.update(id, safe);
        return {
            success: true,
            message: '字典条目更新成功',
            data: this.stripDictDeep(item, state),
        };
    }

    /**
     * 删除字典条目
     */
    @Delete(':id')
    @Permissions('dictionary:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除字典条目' })
    @ApiResponse({ status: 200, description: '删除成功' })
    async delete(@Param('id') id: string) {
        await this.dictionaryService.delete(id);
        return {
            success: true,
            message: '字典条目删除成功',
        };
    }

    /**
     * 启用/禁用字典条目
     */
    @Patch(':id/toggle')
    @Permissions('dictionary:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '启用/禁用字典条目' })
    @ApiResponse({ status: 200, description: '操作成功' })
    async toggle(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        // 本接口写入的是 isActive 字段：被配成「只读」（或不可见）时禁止写入
        if (!state.canEdit.has('isActive')) {
            throw new ForbiddenException('没有可编辑字段的权限');
        }
        const item = await this.dictionaryService.toggle(id);
        return {
            success: true,
            message: item.isActive
                ? '字典条目已启用'
                : '字典条目已禁用',
            data: this.stripDictDeep(item, state),
        };
    }
}
