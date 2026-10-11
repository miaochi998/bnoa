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
import { FinishedProductService } from './finished-product.service';
import {
    QueryFinishedProductDto,
    CreateFinishedProductDto,
    UpdateFinishedProductDto,
} from './dto/finished-product.dto';
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
} from '../role/field-permission.service';

/**
 * 成品字段映射：用于「信息权限」的读取脱敏与写入过滤
 * ⚠️ 多 key 映射说明：
 *   - productId / supplierProductId：除自身外还要隐藏 include 出的关联对象；
 *   - consumableItems / laborItems：读返回叫 finishedProductConsumables / finishedProductLabor，写入 DTO 叫 consumableItems / laborItems。
 */
const FINISHED_PRODUCT_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'code', key: 'code' },
    { field: 'name', key: 'name' },
    { field: 'productId', key: 'productId' },
    { field: 'productId', key: 'product' },
    { field: 'supplierProductId', key: 'supplierProductId' },
    { field: 'supplierProductId', key: 'supplierProduct' },
    { field: 'status', key: 'status' },
    { field: 'cutLength', key: 'cutLength' },
    { field: 'cutWidth', key: 'cutWidth' },
    { field: 'cutHeight', key: 'cutHeight' },
    { field: 'unitWeight', key: 'unitWeight' },
    { field: 'packageType', key: 'packageType' },
    { field: 'packageQuantity', key: 'packageQuantity' },
    { field: 'packageUnit', key: 'packageUnit' },
    { field: 'weight', key: 'weight' },
    { field: 'consumableItems', key: 'consumableItems' },
    { field: 'consumableItems', key: 'finishedProductConsumables' },
    { field: 'laborItems', key: 'laborItems' },
    { field: 'laborItems', key: 'finishedProductLabor' },
    { field: 'materialCost', key: 'materialCost' },
    { field: 'consumableCost', key: 'consumableCost' },
    { field: 'laborCost', key: 'laborCost' },
    { field: 'totalCost', key: 'totalCost' },
    { field: 'remark', key: 'remark' },
];

@ApiTags('成品管理')
@Controller('business/finished-products')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class FinishedProductController {
    constructor(
        private readonly service: FinishedProductService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'finished-product',
            user.roles ?? [],
        );
    }

    // ========== 辅助接口（放在前面避免路由冲突） ==========

    @Get('select/products')
    @Permissions('finished-product:view')
    @ApiOperation({ summary: '获取产品选择列表' })
    async getProductsForSelect() {
        return this.service.getProductsForSelect();
    }

    @Get('select/consumables')
    @Permissions('finished-product:view')
    @ApiOperation({ summary: '获取耗材选择列表' })
    async getConsumablesForSelect() {
        return this.service.getConsumablesForSelect();
    }

    @Get('select/labor-types')
    @Permissions('finished-product:view')
    @ApiOperation({ summary: '获取工种选择列表' })
    async getLaborTypesForSelect() {
        return this.service.getLaborTypesForSelect();
    }

    @Get('select/supplier-products/:productId')
    @Permissions('finished-product:view')
    @ApiOperation({
        summary: '按产品获取供应商价格列表',
    })
    async getSupplierProductsByProduct(
        @Param('productId') productId: string,
    ) {
        return this.service
            .getSupplierProductsByProduct(productId);
    }

    // ========== CRUD ==========

    @Get()
    @Permissions('finished-product:view')
    @ApiOperation({ summary: '获取成品列表' })
    async findAll(
        @Query() query: QueryFinishedProductDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.service.findAll(query);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: this.fieldPermissionService.stripHiddenFieldsForList(
                result.list as any[],
                FINISHED_PRODUCT_FIELD_MAP,
                state,
            ),
        };
    }

    @Get(':id')
    @Permissions('finished-product:view')
    @ApiOperation({ summary: '获取成品详情' })
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const item = await this.service.findById(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFields(
            item as any,
            FINISHED_PRODUCT_FIELD_MAP,
            state,
        );
    }

    @Post()
    @Permissions('finished-product:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '创建成品' })
    async create(
        @Body() dto: CreateFinishedProductDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            FINISHED_PRODUCT_FIELD_MAP,
            state,
        );
        // 创建成品的必填字段：名称 / 产品 / 供应商价格 / 包装类型 / 每包数量 / 包装单位 / 重量
        if (
            !safe.name ||
            !safe.productId ||
            !safe.supplierProductId ||
            !safe.packageType ||
            safe.packageQuantity === undefined ||
            !safe.packageUnit ||
            safe.weight === undefined
        ) {
            throw new ForbiddenException('创建成品所需的必填字段没有编辑权限');
        }
        return this.service.create(safe as CreateFinishedProductDto, user.sub);
    }

    @Patch(':id')
    @Permissions('finished-product:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新成品' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateFinishedProductDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            FINISHED_PRODUCT_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有成品字段的编辑权限');
        }
        return this.service.update(id, safe as UpdateFinishedProductDto, user.sub);
    }

    @Delete(':id')
    @Permissions('finished-product:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除成品' })
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        await this.service.delete(id, user.sub);
    }

    @Post(':id/recalculate')
    @Permissions('finished-product:recalculate')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '重算成品成本' })
    async recalculate(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        // 重算会写入成本类字段：不可编辑「总成本」时不允许重算
        if (!state.canEdit.has('totalCost')) {
            throw new ForbiddenException('没有「总成本」的编辑权限');
        }
        return this.service.recalculate(id, user.sub);
    }

    @Put('reorder')
    @Permissions('finished-product:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量更新成品排序' })
    async reorder(@Body() body: { ids: string[] }) {
        return this.service.reorderFinishedProducts(body.ids);
    }
}
