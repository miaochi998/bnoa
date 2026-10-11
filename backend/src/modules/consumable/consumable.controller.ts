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
import { ConsumableService } from './consumable.service';
import {
    QueryConsumableDto,
    CreateConsumableDto,
    UpdateConsumableDto,
    QueryConsumableSupplierDto,
    CreateConsumableSupplierDto,
    UpdateConsumableSupplierDto,
    CreateConsumablePriceDto,
    UpdateConsumablePriceDto,
} from './dto/consumable.dto';
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
 * 耗材字段映射：用于「信息权限」的读取脱敏与写入过滤
 * ⚠️ 价格：列表返回里挂在 `prices` 数组上；价格接口返回的数组项各自带 `unitPrice`。
 */
const CONSUMABLE_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'name', key: 'name' },
    { field: 'code', key: 'code' },
    { field: 'category', key: 'category' },
    { field: 'specDesc', key: 'specDesc' },
    { field: 'image', key: 'image' },
    { field: 'status', key: 'status' },
    { field: 'remark', key: 'remark' },
    // 只隐藏数组元素里的单价（key 用元素字段名 unitPrice）；
    // 不要用 key:'prices' —— 那会把整个价格列表删掉，前端会以为「没有价格记录」
    { field: 'price.unitPrice', key: 'unitPrice' },
];

/** 耗材供应商字段映射（同一 module：consumable） */
const CONSUMABLE_SUPPLIER_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'supplier.name', key: 'name' },
    { field: 'supplier.code', key: 'code' },
    { field: 'supplier.contact', key: 'contact' },
    { field: 'supplier.phone', key: 'phone' },
    { field: 'supplier.status', key: 'status' },
    { field: 'supplier.remark', key: 'remark' },
];

@ApiTags('耗材管理')
@Controller('business/consumables')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ConsumableController {
    constructor(
        private readonly consumableService: ConsumableService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'consumable',
            user.roles ?? [],
        );
    }

    // ========== 耗材管理 ==========

    @Get()
    @Permissions('consumable:view')
    async findAll(
        @Query() query: QueryConsumableDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.consumableService.findAllConsumables(query);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: this.fieldPermissionService.stripHiddenFieldsForList(
                result.list as any[],
                CONSUMABLE_FIELD_MAP,
                state,
            ),
        };
    }

    @Get(':id')
    @Permissions('consumable:view')
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const item = await this.consumableService.findConsumableById(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFields(
            item as any,
            CONSUMABLE_FIELD_MAP,
            state,
        );
    }

    @Post()
    @Permissions('consumable:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateConsumableDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            CONSUMABLE_FIELD_MAP,
            state,
        );
        // 创建耗材的必填字段：名称 / 分类
        if (!safe.name || !safe.category) {
            throw new ForbiddenException('创建耗材所需的必填字段没有编辑权限');
        }
        return this.consumableService.createConsumable(
            safe as CreateConsumableDto, user.sub,
        );
    }

    @Patch(':id')
    @Permissions('consumable:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateConsumableDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            CONSUMABLE_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有耗材字段的编辑权限');
        }
        return this.consumableService.updateConsumable(
            id, safe as UpdateConsumableDto, user.sub,
        );
    }

    @Delete(':id')
    @Permissions('consumable:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        await this.consumableService.deleteConsumable(
            id, user.sub,
        );
    }

    @Put('reorder')
    @Permissions('consumable:update')
    @HttpCode(HttpStatus.OK)
    async reorderConsumables(@Body() body: { ids: string[] }) {
        return this.consumableService.reorderConsumables(body.ids);
    }

    // ========== 耗材价格 ==========

    @Get(':id/prices')
    @Permissions('consumable:view')
    async findPrices(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const prices = await this.consumableService
            .findPricesByConsumableId(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            prices as any[],
            CONSUMABLE_FIELD_MAP,
            state,
        );
    }

    @Post(':id/prices')
    @Permissions('consumable:price')
    @HttpCode(HttpStatus.OK)
    async createPrice(
        @Param('id') id: string,
        @Body() dto: CreateConsumablePriceDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        if (!state.canEdit.has('price.unitPrice')) {
            throw new ForbiddenException('没有「耗材价格」的编辑权限');
        }
        return this.consumableService.createPrice(
            id, dto, user.sub,
        );
    }

    @Patch(':id/prices/:priceId/set-current')
    @Permissions('consumable:update')
    @HttpCode(HttpStatus.OK)
    async setCurrentPrice(
        @Param('id') id: string,
        @Param('priceId') priceId: string,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        if (!state.canEdit.has('price.unitPrice')) {
            throw new ForbiddenException('没有「耗材价格」的编辑权限');
        }
        return this.consumableService.setCurrentPrice(
            id, priceId, user.sub,
        );
    }

    @Patch(':id/prices/:priceId')
    @Permissions('consumable:update')
    @HttpCode(HttpStatus.OK)
    async updatePrice(
        @Param('id') id: string,
        @Param('priceId') priceId: string,
        @Body() dto: UpdateConsumablePriceDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            CONSUMABLE_FIELD_MAP,
            state,
        );
        if (!state.canEdit.has('price.unitPrice') && Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有「耗材价格」的编辑权限');
        }
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有「耗材价格」的编辑权限');
        }
        return this.consumableService.updatePrice(
            id, priceId, safe as UpdateConsumablePriceDto, user.sub,
        );
    }

    @Delete(':id/prices/:priceId')
    @Permissions('consumable:delete')
    @HttpCode(HttpStatus.OK)
    async deletePrice(
        @Param('id') id: string,
        @Param('priceId') priceId: string,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        if (!state.canEdit.has('price.unitPrice')) {
            throw new ForbiddenException('没有「耗材价格」的编辑权限');
        }
        await this.consumableService.deletePrice(
            id, priceId, user.sub,
        );
    }
}

// 耗材供应商独立 Controller
@ApiTags('耗材供应商管理')
@Controller('business/consumable-suppliers')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ConsumableSupplierController {
    constructor(
        private readonly consumableService: ConsumableService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'consumable',
            user.roles ?? [],
        );
    }

    @Get()
    @Permissions('consumable:view')
    async findAll(
        @Query() query: QueryConsumableSupplierDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result: any = await this.consumableService.findAllSuppliers(query);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: this.fieldPermissionService.stripHiddenFieldsForList(
                result.list as any[],
                CONSUMABLE_SUPPLIER_FIELD_MAP,
                state,
            ),
        };
    }

    @Get('select')
    @Permissions('consumable:view')
    async findAllForSelect(@CurrentUser() user: UserPayload) {
        const list = await this.consumableService
            .findAllSuppliersForSelect();
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            list as any[],
            CONSUMABLE_SUPPLIER_FIELD_MAP,
            state,
        );
    }

    @Post()
    @Permissions('consumable-supplier:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateConsumableSupplierDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            CONSUMABLE_SUPPLIER_FIELD_MAP,
            state,
        );
        if (!safe.name || !safe.code) {
            throw new ForbiddenException('创建耗材供应商所需的必填字段没有编辑权限');
        }
        return this.consumableService.createSupplier(
            safe as CreateConsumableSupplierDto, user.sub,
        );
    }

    @Patch(':id')
    @Permissions('consumable-supplier:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateConsumableSupplierDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            CONSUMABLE_SUPPLIER_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有耗材供应商字段的编辑权限');
        }
        return this.consumableService.updateSupplier(
            id, safe as UpdateConsumableSupplierDto, user.sub,
        );
    }

    @Delete(':id')
    @Permissions('consumable-supplier:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        await this.consumableService.deleteSupplier(
            id, user.sub,
        );
    }

    @Put('reorder')
    @Permissions('consumable-supplier:update')
    @HttpCode(HttpStatus.OK)
    async reorderSuppliers(@Body() body: { ids: string[] }) {
        return this.consumableService.reorderConsumableSuppliers(body.ids);
    }
}
