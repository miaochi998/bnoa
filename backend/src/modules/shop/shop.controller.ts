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
import { ShopService } from './shop.service';
import {
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';
import { CreateShopDto, UpdateShopDto, QueryShopDto } from './dto/shop.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  UserPayload,
} from '../../common/decorators/current-user.decorator';

/**
 * 店铺字段映射：用于「信息权限」的读取脱敏与写入过滤
 */
const SHOP_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'name', key: 'name' },
  { field: 'platformId', key: 'platformId' },
  { field: 'status', key: 'status' },
  { field: 'managerId', key: 'managerId' },
  { field: 'remark', key: 'remark' },
  // ⚠️ 隐藏外键时必须同时隐藏它的关联对象，否则会通过关联对象泄露被隐藏的信息
  //    （例如隐藏 managerId 后，接口返回的 manager.name 仍会暴露店铺负责人）
  { field: 'managerId', key: 'manager' },
  { field: 'platformId', key: 'platform' },
];

/**
 * 店铺别名字段映射：店铺别名单独一张子表（shop_aliases），
 * 列表/新增返回的是别名记录数组，元素属性名就是 `alias`。
 */
const SHOP_ALIAS_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'alias.alias', key: 'alias' },
];

@ApiTags('店铺管理')
@Controller('business/shops')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ShopController {
    constructor(
        private readonly shopService: ShopService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'shop',
            user.roles ?? [],
        );
    }

    @Get()
    @Permissions('shop:view')
    async findAll(
        @Query() query: QueryShopDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.shopService.findAll(query);
        const state = await this.resolveFields(user);
        // 列表可能是 {list,...} 或数组
        if (Array.isArray(result)) {
            return this.fieldPermissionService.stripHiddenFieldsForList(
                result,
                SHOP_FIELD_MAP,
                state,
            );
        }
        return {
            ...result,
            list: this.fieldPermissionService.stripHiddenFieldsForList(
                (result as any).list ?? [],
                SHOP_FIELD_MAP,
                state,
            ),
        };
    }

    @Get('active')
    @Permissions('shop:view')
    async findActive(@CurrentUser() user: UserPayload) {
        const list = await this.shopService.findActive();
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            list as any[],
            SHOP_FIELD_MAP,
            state,
        );
    }

    @Get(':id')
    @Permissions('shop:view')
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const data = await this.shopService.findById(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFields(
            data,
            SHOP_FIELD_MAP,
            state,
        );
    }

    @Post()
    @Permissions('shop:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateShopDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            SHOP_FIELD_MAP,
            state,
        );
        // 必填字段被「字段权限」剔除时给出明确提示，而不是让 Prisma 抛 500
        if (!(safe as any).name) {
            throw new ForbiddenException('没有「店铺名称」的编辑权限，无法创建店铺');
        }
        const created = await this.shopService.create(safe, user.sub);
        return this.fieldPermissionService.stripHiddenFields(
            created as any,
            SHOP_FIELD_MAP,
            state,
        );
    }

    @Patch(':id')
    @Permissions('shop:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateShopDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            SHOP_FIELD_MAP,
            state,
        );
        const updated = await this.shopService.update(id, safe, user.sub);
        // 写响应与读接口一致地脱敏（否则可借更新接口读回被隐藏字段）
        return this.fieldPermissionService.stripHiddenFields(
            updated as any,
            SHOP_FIELD_MAP,
            state,
        );
    }

    @Delete(':id')
    @Permissions('shop:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.shopService.delete(id, userId);
    }

    @Put('reorder')
    @Permissions('shop:update')
    @HttpCode(HttpStatus.OK)
    async reorder(@Body() body: { ids: string[] }) {
        return this.shopService.reorderShops(body.ids);
    }

    // ========== 别名管理 ==========

    @Get(':id/aliases')
    @Permissions('shop:view')
    async getAliases(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const list = await this.shopService.getAliases(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            list as any[],
            SHOP_ALIAS_FIELD_MAP,
            state,
        );
    }

    @Post(':id/aliases')
    @Permissions('shop:update')
    @HttpCode(HttpStatus.OK)
    async addAlias(
        @Param('id') id: string,
        @Body('alias') alias: string,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        if (!state.canEdit.has('alias.alias')) {
            throw new ForbiddenException('没有「店铺别名」的编辑权限');
        }
        const record = await this.shopService.addAlias(id, alias);
        return this.fieldPermissionService.stripHiddenFields(
            record as any,
            SHOP_ALIAS_FIELD_MAP,
            state,
        );
    }

    @Delete(':id/aliases/:aliasId')
    @Permissions('shop:update')
    @HttpCode(HttpStatus.OK)
    async removeAlias(
        @Param('aliasId') aliasId: string,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        if (!state.canEdit.has('alias.alias')) {
            throw new ForbiddenException('没有「店铺别名」的编辑权限');
        }
        await this.shopService.removeAlias(aliasId);
    }
}
