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
import { ExpressService } from './express.service';
import {
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';
import {
    CreateExpressCompanyDto,
    UpdateExpressCompanyDto,
    QueryExpressCompanyDto,
    UpdateZoneDto,
    BatchUpdateZonesDto,
    UpdateWeightRangeDto,
    BatchUpdatePricesDto,
    CopyPricesDto,
    CreateSurchargeDto,
    UpdateSurchargeDto,
    CalculateExpressCostDto,
} from './dto/express.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  UserPayload,
} from '../../common/decorators/current-user.decorator';

/**
 * 快递公司字段映射：用于「信息权限」的读取脱敏与写入过滤
 */
const EXPRESS_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'name', key: 'name' },
  { field: 'code', key: 'code' },
  { field: 'status', key: 'status' },
  { field: 'contactName', key: 'contactName' },
  { field: 'contactPhone', key: 'contactPhone' },
  { field: 'remark', key: 'remark' },
];

/** 区域：字段映射 */
const EXPRESS_ZONE_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'zone.name', key: 'name' },
  { field: 'zone.provinces', key: 'provinces' },
];

/** 重量区间：字段映射 */
const EXPRESS_WEIGHT_RANGE_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'weightRange.label', key: 'label' },
  { field: 'weightRange.minWeight', key: 'minWeight' },
  { field: 'weightRange.maxWeight', key: 'maxWeight' },
];

/** 附加费：字段映射 */
const EXPRESS_SURCHARGE_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'surcharge.name', key: 'name' },
  { field: 'surcharge.provinces', key: 'provinces' },
  { field: 'surcharge.weightFrom', key: 'weightFrom' },
  { field: 'surcharge.weightTo', key: 'weightTo' },
  { field: 'surcharge.amount', key: 'amount' },
];

/**
 * 价格：字段映射
 * ⚠️ 价格矩阵本身是 zoneId → weightRangeId → 数值 的纯数值结构，没有字段名可删，
 *    由 findPriceMatrix 单独处理（不可见时整体清空）；
 *    而批量改价 / 复制价格返回的是 expressPrice 记录数组，每条记录带 `price` 属性，
 *    这里用 key='price' 对记录逐个脱敏。
 */
const EXPRESS_PRICE_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'price.price', key: 'price' },
];

@ApiTags('快递管理')
@Controller('business/express')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ExpressController {
    constructor(
        private readonly expressService: ExpressService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'express',
            user.roles ?? [],
        );
    }

    // ========== 快递公司管理 ==========

    @Get('companies')
    @Permissions('express:view')
    async findAllCompanies(
        @Query() query: QueryExpressCompanyDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.expressService.findAllCompanies(query);
        const state = await this.resolveFields(user);
        if (Array.isArray(result)) {
            return this.fieldPermissionService.stripHiddenFieldsForList(
                result,
                EXPRESS_FIELD_MAP,
                state,
            );
        }
        return {
            ...result,
            list: this.fieldPermissionService.stripHiddenFieldsForList(
                (result as any).list ?? [],
                EXPRESS_FIELD_MAP,
                state,
            ),
        };
    }

    @Get('companies/select')
    @Permissions('express:view')
    async findAllCompaniesForSelect(
        @CurrentUser() user: UserPayload,
    ) {
        const list = await this.expressService.findAllCompaniesForSelect();
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            list,
            EXPRESS_FIELD_MAP,
            state,
        );
    }

    @Get('companies/:id')
    @Permissions('express:view')
    async findCompanyById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const data = await this.expressService.findCompanyById(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFields(
            data,
            EXPRESS_FIELD_MAP,
            state,
        );
    }

    @Post('companies')
    @Permissions('express:create')
    @HttpCode(HttpStatus.OK)
    async createCompany(
        @Body() dto: CreateExpressCompanyDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            EXPRESS_FIELD_MAP,
            state,
        );
        return this.expressService.createCompany(safe, user.sub);
    }

    @Patch('companies/:id')
    @Permissions('express:update')
    @HttpCode(HttpStatus.OK)
    async updateCompany(
        @Param('id') id: string,
        @Body() dto: UpdateExpressCompanyDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto,
            EXPRESS_FIELD_MAP,
            state,
        );
        return this.expressService.updateCompany(id, safe, user.sub);
    }

    @Delete('companies/:id')
    @Permissions('express:delete')
    @HttpCode(HttpStatus.OK)
    async deleteCompany(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.expressService.deleteCompany(id, userId);
    }

    @Put('companies/reorder')
    @Permissions('express:update')
    @HttpCode(HttpStatus.OK)
    async reorderCompanies(@Body() body: { ids: string[] }) {
        return this.expressService.reorderExpressCompanies(body.ids);
    }

    // ========== 区域配置管理 ==========

    @Get('companies/:id/zones')
    @Permissions('express:view')
    async findZonesByCompanyId(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const list = await this.expressService.findZonesByCompanyId(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            list as any[],
            EXPRESS_ZONE_FIELD_MAP,
            state,
        );
    }

    @Patch('zones/:id')
    @Permissions('express:zone')
    @HttpCode(HttpStatus.OK)
    async updateZone(
        @Param('id') id: string,
        @Body() dto: UpdateZoneDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            EXPRESS_ZONE_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有「区域配置」字段的编辑权限');
        }
        return this.expressService.updateZone(id, safe as UpdateZoneDto);
    }

    @Patch('companies/:id/zones/batch')
    @Permissions('express:zone')
    @HttpCode(HttpStatus.OK)
    async batchUpdateZones(
        @Param('id') id: string,
        @Body() dto: BatchUpdateZonesDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        if (!state.canEdit.has('zone.provinces')) {
            throw new ForbiddenException('没有「包含省份」的编辑权限');
        }
        return this.expressService.batchUpdateZones(id, dto);
    }

    // ========== 重量段管理 ==========

    @Get('companies/:id/weight-ranges')
    @Permissions('express:view')
    async findWeightRangesByCompanyId(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const rows = await this.expressService.findWeightRangesByCompanyId(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            rows as any[],
            EXPRESS_WEIGHT_RANGE_FIELD_MAP,
            state,
        );
    }

    @Patch('weight-ranges/:id')
    @Permissions('express:weight')
    @HttpCode(HttpStatus.OK)
    async updateWeightRange(
        @Param('id') id: string,
        @Body() dto: UpdateWeightRangeDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            EXPRESS_WEIGHT_RANGE_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有「重量区间」字段的编辑权限');
        }
        return this.expressService.updateWeightRange(id, safe as UpdateWeightRangeDto);
    }

    // ========== 价格矩阵管理 ==========

    @Get('companies/:id/prices/matrix')
    @Permissions('express:view')
    async findPriceMatrix(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const data = await this.expressService.findPriceMatrix(id);
        const state = await this.resolveFields(user);
        // 矩阵是 zoneId → weightRangeId → 单价 的纯数值结构，无法按字段名删除，
        // 因此单价不可见时整体清空，避免通过数值反推被隐藏的单价
        const canViewPrice = state.canView.has('price.price');
        return {
            zones: this.fieldPermissionService.stripHiddenFieldsForList(
                data.zones as any[],
                EXPRESS_ZONE_FIELD_MAP,
                state,
            ),
            weightRanges: this.fieldPermissionService.stripHiddenFieldsForList(
                data.weightRanges as any[],
                EXPRESS_WEIGHT_RANGE_FIELD_MAP,
                state,
            ),
            matrix: canViewPrice ? data.matrix : {},
        };
    }

    @Patch('companies/:id/prices/batch')
    @Permissions('express:price')
    @HttpCode(HttpStatus.OK)
    async batchUpdatePrices(
        @Param('id') id: string,
        @Body() dto: BatchUpdatePricesDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        if (!state.canEdit.has('price.price')) {
            throw new ForbiddenException('没有「单价」的编辑权限');
        }
        const result = await this.expressService.batchUpdatePrices(id, dto);
        // 返回的是 expressPrice 记录数组（含 price），按字段权限脱敏
        return this.fieldPermissionService.stripHiddenFieldsForList(
            result as any[],
            EXPRESS_PRICE_FIELD_MAP,
            state,
        );
    }

    @Post('companies/:id/prices/copy')
    @Permissions('express:price')
    @HttpCode(HttpStatus.OK)
    async copyPrices(
        @Param('id') id: string,
        @Body() dto: CopyPricesDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        if (!state.canEdit.has('price.price')) {
            throw new ForbiddenException('没有「单价」的编辑权限');
        }
        const result = await this.expressService.copyPrices(id, dto);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            result as any[],
            EXPRESS_PRICE_FIELD_MAP,
            state,
        );
    }

    // ========== 附加费管理 ==========

    @Get('companies/:id/surcharges')
    @Permissions('express:view')
    async findSurchargesByCompanyId(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const rows = await this.expressService.findSurchargesByCompanyId(id);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFieldsForList(
            rows as any[],
            EXPRESS_SURCHARGE_FIELD_MAP,
            state,
        );
    }

    @Post('companies/:id/surcharges')
    @Permissions('express:surcharge')
    @HttpCode(HttpStatus.OK)
    async createSurcharge(
        @Param('id') id: string,
        @Body() dto: CreateSurchargeDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            EXPRESS_SURCHARGE_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有「附加费」字段的编辑权限');
        }
        return this.expressService.createSurcharge(id, safe as CreateSurchargeDto);
    }

    @Patch('surcharges/:id')
    @Permissions('express:surcharge')
    @HttpCode(HttpStatus.OK)
    async updateSurcharge(
        @Param('id') id: string,
        @Body() dto: UpdateSurchargeDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            EXPRESS_SURCHARGE_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有「附加费」字段的编辑权限');
        }
        return this.expressService.updateSurcharge(id, safe as UpdateSurchargeDto);
    }

    @Delete('surcharges/:id')
    @Permissions('express:surcharge')
    @HttpCode(HttpStatus.OK)
    async deleteSurcharge(@Param('id') id: string) {
        await this.expressService.deleteSurcharge(id);
    }

    // ========== 快递成本计算 ==========

    @Post('calculate-cost')
    @Permissions('express:view')
    @HttpCode(HttpStatus.OK)
    async calculateCost(
        @Body() dto: CalculateExpressCostDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.expressService.calculateCost(dto);
        const state = await this.resolveFields(user);
        // 单价不可见时，成本里的基础运费同样是单价的直接化身，
        // 一并清零，避免通过 basePrice / totalPrice 反推被隐藏的单价（与矩阵处理保持一致）
        if (!state.canView.has('price.price')) {
            return { ...result, basePrice: 0, totalPrice: 0 };
        }
        return result;
    }
}
