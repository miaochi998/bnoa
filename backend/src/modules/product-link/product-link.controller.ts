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
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
} from '@nestjs/swagger';
import { ProductLinkService } from './product-link.service';
import {
    QueryProductLinkDto,
    CreateProductLinkDto,
    UpdateProductLinkDto,
} from './dto/product-link.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  UserPayload,
} from '../../common/decorators/current-user.decorator';
import {
  DataScope,
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';

/**
 * 链接字段映射：用于「信息权限」的读取脱敏与写入过滤
 * ⚠️ shopId 登记了两条映射：除自身外，还要一并隐藏 include 出来的 shop 对象
 */
const PRODUCT_LINK_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'name', key: 'name' },
    { field: 'shopId', key: 'shopId' },
    { field: 'shopId', key: 'shop' },
    { field: 'status', key: 'status' },
    { field: 'platformUrl', key: 'platformUrl' },
    { field: 'platformItemId', key: 'platformItemId' },
    { field: 'remark', key: 'remark' },
];

@ApiTags('链接管理')
@Controller('business/product-links')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ProductLinkController {
    constructor(
        private readonly service: ProductLinkService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /**
     * 数据范围：该用户能看哪些店铺（undefined = 不限）
     */
    private async resolveShopIds(
        user: UserPayload,
    ): Promise<string[] | undefined> {
        return this.fieldPermissionService.resolveVisibleShopIds(
            user.sub,
            'product-link',
            user.roles ?? [],
        );
    }

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'product-link',
            user.roles ?? [],
        );
    }

    // ========== 辅助接口 ==========

    @Get('select/shops')
    @Permissions('product-link:view')
    @ApiOperation({ summary: '获取店铺选择列表' })
    async getShopsForSelect(@CurrentUser() user: UserPayload) {
        const allowedShopIds = await this.resolveShopIds(user);
        return this.service.getShopsForSelect(allowedShopIds);
    }

    // ========== CRUD ==========

    @Get()
    @Permissions('product-link:view')
    @ApiOperation({ summary: '获取链接列表' })
    async findAll(
        @Query() query: QueryProductLinkDto,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const result = await this.service.findAll(query, allowedShopIds);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: this.fieldPermissionService.stripHiddenFieldsForList(
                result.list as any[],
                PRODUCT_LINK_FIELD_MAP,
                state,
            ),
        };
    }

    @Get(':id')
    @Permissions('product-link:view')
    @ApiOperation({ summary: '获取链接详情' })
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const link = await this.service.findById(id, allowedShopIds);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFields(
            link as any,
            PRODUCT_LINK_FIELD_MAP,
            state,
        );
    }

    @Post()
    @Permissions('product-link:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '创建链接' })
    async create(
        @Body() dto: CreateProductLinkDto,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            PRODUCT_LINK_FIELD_MAP,
            state,
        );
        // 链接名称与所属店铺是必填项：被配成只读/隐藏时不允许创建
        if (!safe.name || !safe.shopId) {
            throw new ForbiddenException('没有「链接名称」或「所属店铺」的编辑权限');
        }
        return this.service.create(
            safe as CreateProductLinkDto,
            user.sub,
            allowedShopIds,
        );
    }

    @Patch(':id')
    @Permissions('product-link:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新链接' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateProductLinkDto,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            PRODUCT_LINK_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有链接字段的编辑权限');
        }
        return this.service.update(
            id,
            safe as UpdateProductLinkDto,
            user.sub,
            allowedShopIds,
        );
    }

    @Delete(':id')
    @Permissions('product-link:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除链接' })
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        await this.service.delete(id, user.sub, allowedShopIds);
    }

    @Put('reorder')
    @Permissions('product-link:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量更新链接排序' })
    async reorder(
        @Body() body: { ids: string[] },
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        return this.service.reorderProductLinks(body.ids, allowedShopIds);
    }
}
