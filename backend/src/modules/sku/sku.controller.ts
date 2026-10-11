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
    ApiOperation,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  UserPayload,
} from '../../common/decorators/current-user.decorator';
import { SkuService } from './sku.service';
import {
  DataScope,
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';
import {
    CreateSkuDto,
    UpdateSkuDto,
    SkuQueryDto,
} from './dto/sku.dto';

/**
 * SKU 字段映射：用于「信息权限」的读取脱敏与写入过滤
 * ⚠️ 多 key 映射说明：
 *   - linkId：除自身外还要隐藏 include 出来的 link 对象；
 *   - finishedProducts：读取返回叫 finishedProducts，写入 DTO 叫 finishedProductItems。
 */
const SKU_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'name', key: 'name' },
    { field: 'linkId', key: 'linkId' },
    { field: 'linkId', key: 'link' },
    { field: 'type', key: 'type' },
    { field: 'status', key: 'status' },
    { field: 'weight', key: 'weight' },
    { field: 'finishedProducts', key: 'finishedProducts' },
    { field: 'finishedProducts', key: 'finishedProductItems' },
    { field: 'productCost', key: 'productCost' },
    { field: 'expressCost', key: 'expressCost' },
    { field: 'totalCost', key: 'totalCost' },
    { field: 'comboPackageFee', key: 'comboPackageFee' },
    { field: 'miscFee', key: 'miscFee' },
    { field: 'defaultExpressCompanyId', key: 'defaultExpressCompanyId' },
    { field: 'defaultExpressCompanyId', key: 'expressCompany' },
    { field: 'remark', key: 'remark' },
];

@ApiTags('SKU管理')
@Controller('business/skus')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class SkuController {
    constructor(
        private readonly skuService: SkuService,
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
            'sku',
            user.roles ?? [],
        );
    }

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'sku',
            user.roles ?? [],
        );
    }

    /**
     * 关联成品内嵌的「成品成本」二次脱敏
     *
     * `sku.service` 的 include 会带出 `finishedProducts[].finishedProduct.totalCost`，
     * 而 FieldKeyMapping 无法表达「数组元素里的字段」——若不单独处理，
     * 把「成品管理-总成本」配成不可见的角色仍能从 SKU 页面读到成品成本。
     */
    private async stripNestedFinishedProductCost(
        node: any,
        user: UserPayload,
    ): Promise<any> {
        const fpState = await this.fieldPermissionService.resolve(
            user.sub,
            'finished-product',
            user.roles ?? [],
        );
        if (fpState.canView.has('totalCost')) return node;
        const scrub = (sku: any) => {
            const items = sku?.finishedProducts;
            if (!Array.isArray(items)) return sku;
            for (const item of items) {
                const fp = item?.finishedProduct;
                if (fp && typeof fp === 'object') {
                    delete fp.totalCost;
                }
            }
            return sku;
        };
        return Array.isArray(node) ? node.map(scrub) : scrub(node);
    }

    // ========== 辅助接口 ==========

    @Get('select/links')
    @Permissions('sku:view')
    @ApiOperation({ summary: '获取链接选择列表' })
    async getLinksForSelect(@CurrentUser() user: UserPayload) {
        const allowedShopIds = await this.resolveShopIds(user);
        return this.skuService.getLinksForSelect(allowedShopIds);
    }

    @Get('select/finished-products')
    @Permissions('sku:view')
    @ApiOperation({ summary: '获取成品选择列表' })
    async getFinishedProductsForSelect(@CurrentUser() user: UserPayload) {
        const list = await this.skuService.getFinishedProductsForSelect();
        return this.stripNestedFinishedProductCost(list, user);
    }

    // ========== CRUD ==========

    @Get()
    @Permissions('sku:view')
    @ApiOperation({ summary: '获取SKU列表' })
    async findAll(
        @Query() query: SkuQueryDto,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const result = await this.skuService.findAll(query, allowedShopIds);
        const state = await this.resolveFields(user);
        const list = this.fieldPermissionService.stripHiddenFieldsForList(
            result.list as any[],
            SKU_FIELD_MAP,
            state,
        );
        return {
            ...result,
            list: await this.stripNestedFinishedProductCost(list, user),
        };
    }

    @Get(':id')
    @Permissions('sku:view')
    @ApiOperation({ summary: '获取SKU详情' })
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const sku = await this.skuService.findById(id, allowedShopIds);
        const state = await this.resolveFields(user);
        const stripped = this.fieldPermissionService.stripHiddenFields(
            sku as any,
            SKU_FIELD_MAP,
            state,
        );
        return this.stripNestedFinishedProductCost(stripped, user);
    }

    @Post()
    @Permissions('sku:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '创建SKU' })
    async create(
        @Body() dto: CreateSkuDto,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            SKU_FIELD_MAP,
            state,
        );
        // 创建 SKU 的必填字段：名称 / 所属链接 / 类型 / 重量 / 关联成品
        if (
            !safe.name ||
            !safe.linkId ||
            !safe.type ||
            safe.weight === undefined
        ) {
            throw new ForbiddenException('创建 SKU 所需的必填字段没有编辑权限');
        }
        if (!safe.finishedProductItems || safe.finishedProductItems.length === 0) {
            throw new ForbiddenException('没有「关联成品」的编辑权限');
        }
        return this.skuService.create(
            safe as CreateSkuDto,
            user.sub,
            allowedShopIds,
        );
    }

    @Patch(':id')
    @Permissions('sku:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新SKU' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateSkuDto,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            SKU_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有 SKU 字段的编辑权限');
        }
        return this.skuService.update(
            id,
            safe as UpdateSkuDto,
            user.sub,
            allowedShopIds,
        );
    }

    @Post(':id/recalculate')
    @Permissions('sku:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '重算SKU成本' })
    async recalculate(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const state = await this.resolveFields(user);
        // 重算会写入成本类字段：不可编辑「总成本」时不允许重算
        if (!state.canEdit.has('totalCost')) {
            throw new ForbiddenException('没有「总成本」的编辑权限');
        }
        return this.skuService.recalculate(id, user.sub, allowedShopIds);
    }

    @Delete(':id')
    @Permissions('sku:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除SKU' })
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        await this.skuService.delete(id, user.sub, allowedShopIds);
    }

    @Put('reorder')
    @Permissions('sku:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量更新SKU排序' })
    async reorder(
        @Body() body: { ids: string[] },
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        return this.skuService.reorderSkus(body.ids, allowedShopIds);
    }
}
