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
import { SupplierService } from './supplier.service';
import {
    CreateSupplierDto,
    UpdateSupplierDto,
    SupplierQueryDto,
} from './dto/supplier.dto';
import {
    CreateSupplierProductDto,
    UpdateSupplierProductDto,
    SupplierProductQueryDto,
} from './dto/supplier-product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
    CurrentUser,
    UserPayload,
} from '../../common/decorators/current-user.decorator';
import {
    FieldPermissionService,
    FieldKeyMapping,
} from '../role/field-permission.service';


/** 供应商主表字段 ↔ 注册表字段 映射 */
const SUPPLIER_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'code', key: 'code' },
    { field: 'name', key: 'name' },
    { field: 'status', key: 'status' },
    { field: 'contact', key: 'contact' },
    { field: 'phone', key: 'phone' },
    { field: 'address', key: 'address' },
    { field: 'remark', key: 'remark' },
];

/** 供应商-产品关联字段映射（含嵌套的 product.code / product.name） */
const SUPPLIER_PRODUCT_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'product.code', key: 'product.code' },
    { field: 'product.name', key: 'product.name' },
    { field: 'product.styleName', key: 'styleName' },
    { field: 'product.supplyPrice', key: 'supplyPrice' },
    { field: 'product.priceUnit', key: 'priceUnit' },
    { field: 'product.priceUnitCustom', key: 'priceUnitCustom' },
    { field: 'product.status', key: 'status' },
    { field: 'product.remark', key: 'remark' },
    // `GET /business/suppliers/product/:productId/suppliers` 会带出供应商整行
    // （service 里 `include: { supplier: true }`）——必须把供应商的敏感字段一并纳入，
    // 否则管理员隐藏了联系人/电话/地址，仍可从该接口读回。
    { field: 'contact', key: 'supplier.contact' },
    { field: 'phone', key: 'supplier.phone' },
    { field: 'address', key: 'supplier.address' },
];

@ApiTags('供应商管理')
@ApiBearerAuth()
@Controller('business/suppliers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SupplierController {
    constructor(
        private readonly supplierService: SupplierService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 解析当前用户在 supplier 模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'supplier',
            user.roles ?? [],
        );
    }

    /**
     * 写接口响应脱敏：与同文件的读接口使用同一套字段映射，
     * 避免「只改 name，却把被隐藏字段的库内原值随响应回显」的泄露。
     */
    private stripWriteResult<T extends Record<string, any>>(
        row: T,
        state: any,
        mappings: FieldKeyMapping[] = SUPPLIER_FIELD_MAP,
    ): T {
        if (!row) return row;
        return this.fieldPermissionService.stripHiddenFields(
            row,
            mappings,
            state,
        );
    }

    @Post()
    @Permissions('supplier:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateSupplierDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            SUPPLIER_FIELD_MAP,
            state,
        );
        // 必填字段被「字段权限」剔除时给出明确提示，而不是让 Prisma 抛 500
        if (!(safe as any).name) {
            throw new ForbiddenException('没有「供应商名称」的编辑权限，无法创建供应商');
        }
        const created = await this.supplierService.create(safe, user.sub);
        return this.stripWriteResult(created, state);
    }

    @Patch(':id')
    @Permissions('supplier:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateSupplierDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            SUPPLIER_FIELD_MAP,
            state,
        );
        const updated = await this.supplierService.update(
            id,
            safe,
            user.sub,
        );
        return this.stripWriteResult(updated, state);
    }

    @Delete(':id')
    @Permissions('supplier:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.supplierService.delete(id, userId);
    }

    @Get('select/list')
    @Permissions('supplier:view')
    async findAllForSelect(@CurrentUser() user: UserPayload) {
        const rows = await this.supplierService.findAllForSelect();
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            rows,
            SUPPLIER_FIELD_MAP,
            state,
        );
    }

    @Get()
    @Permissions('supplier:view')
    async findAll(
        @Query() query: SupplierQueryDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.supplierService.findAll(query);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: this.fieldPermissionService.stripHiddenFieldsForList(
                result.list,
                SUPPLIER_FIELD_MAP,
                state,
            ),
        };
    }

    // ========== 供应商-产品关联管理 ==========

    @Get('products')
    @Permissions('supplier:product')
    async findAllSupplierProducts(
        @Query() query: SupplierProductQueryDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result =
            await this.supplierService.findAllSupplierProducts(query);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: this.fieldPermissionService.stripHiddenFieldsForList(
                result.list,
                SUPPLIER_PRODUCT_FIELD_MAP,
                state,
            ),
        };
    }

    @Post('products')
    @Permissions('supplier:product-manage')
    @HttpCode(HttpStatus.OK)
    async createSupplierProduct(
        @Body() dto: CreateSupplierProductDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            SUPPLIER_PRODUCT_FIELD_MAP,
            state,
        );
        const created = await this.supplierService.createSupplierProduct(
            safe,
            user.sub,
        );
        return this.stripWriteResult(
            created,
            state,
            SUPPLIER_PRODUCT_FIELD_MAP,
        );
    }

    @Get('products/:id')
    @Permissions('supplier:product')
    async findSupplierProductById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const row =
            await this.supplierService.findSupplierProductById(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFields(
            row,
            SUPPLIER_PRODUCT_FIELD_MAP,
            state,
        );
    }

    @Patch('products/:id')
    @Permissions('supplier:product-manage')
    @HttpCode(HttpStatus.OK)
    async updateSupplierProduct(
        @Param('id') id: string,
        @Body() dto: UpdateSupplierProductDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            SUPPLIER_PRODUCT_FIELD_MAP,
            state,
        );
        const updated =
            await this.supplierService.updateSupplierProduct(
                id,
                safe,
                user.sub,
            );
        return this.stripWriteResult(
            updated,
            state,
            SUPPLIER_PRODUCT_FIELD_MAP,
        );
    }

    @Delete('products/:id')
    @Permissions('supplier:product-manage')
    @HttpCode(HttpStatus.OK)
    async deleteSupplierProduct(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.supplierService.deleteSupplierProduct(
            id,
            userId,
        );
    }

    @Get('product/:productId/suppliers')
    @Permissions('supplier:view')
    async findSuppliersByProduct(
        @Param('productId') productId: string,
        @CurrentUser() user: UserPayload,
    ) {
        const rows = await this.supplierService.findSuppliersByProduct(
            productId,
        );
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            rows,
            SUPPLIER_PRODUCT_FIELD_MAP,
            state,
        );
    }

    @Get(':id/products')
    @Permissions('supplier:product')
    async findProductsBySupplier(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const rows = await this.supplierService.findProductsBySupplier(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            rows,
            SUPPLIER_PRODUCT_FIELD_MAP,
            state,
        );
    }

    @Get(':id')
    @Permissions('supplier:view')
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const row = await this.supplierService.findById(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFields(
            row,
            SUPPLIER_FIELD_MAP,
            state,
        );
    }

    // ========== 排序管理 ==========

    @Put('reorder')
    @Permissions('supplier:update')
    @HttpCode(HttpStatus.OK)
    async reorderSuppliers(@Body() body: { ids: string[] }) {
        return this.supplierService.reorderSuppliers(body.ids);
    }

    @Put('products/reorder')
    @Permissions('supplier:product-manage')
    @HttpCode(HttpStatus.OK)
    async reorderSupplierProducts(@Body() body: { ids: string[] }) {
        return this.supplierService.reorderSupplierProducts(body.ids);
    }
}
