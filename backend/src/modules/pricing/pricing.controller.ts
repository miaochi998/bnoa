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
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  UserPayload,
} from '../../common/decorators/current-user.decorator';
import { PricingService } from './pricing.service';
import {
  DataScope,
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';
import {
    CalculatePricingDto,
    CommissionAnalysisDto,
    SavePricingPlanDto,
    UpdatePricingPlanDto,
    PricingPlanQueryDto,
} from './dto/pricing.dto';

/**
 * 定价方案字段映射：用于「信息权限」的读取脱敏与写入过滤
 * ⚠️ 多 key 映射说明：
 *   - linkId：基础列表返回 productLink，带汇总时被改写为 link，三种形态都要处理；
 *   - skuSummaries：方案汇总明细（含成本/建议售价/毛利润），属派生敏感数据。
 */
const PRICING_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'name', key: 'name' },
    { field: 'linkId', key: 'linkId' },
    { field: 'linkId', key: 'productLink' },
    { field: 'linkId', key: 'link' },
    { field: 'profitRates', key: 'profitRates' },
    { field: 'commissionRate', key: 'commissionRate' },
    { field: 'taxRate', key: 'taxRate' },
    { field: 'talentCommissionRate', key: 'talentCommissionRate' },
    { field: 'selectedPrices', key: 'selectedPrices' },
    { field: 'skuSummaries', key: 'skuSummaries' },
    { field: 'remark', key: 'remark' },
];

@ApiTags('定价计算')
@Controller('business/pricing')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PricingController {
    constructor(
        private readonly pricingService: PricingService,
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
            'pricing',
            user.roles ?? [],
        );
    }

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'pricing',
            user.roles ?? [],
        );
    }

    // ========== 辅助接口 ==========

    @Get('select/links')
    @Permissions('pricing:view')
    @ApiOperation({ summary: '获取链接选择列表' })
    async getLinksForSelect(@CurrentUser() user: UserPayload) {
        const allowedShopIds = await this.resolveShopIds(user);
        return this.pricingService
            .getLinksForSelect(allowedShopIds);
    }

    // ========== 计算引擎 ==========

    @Post('calculate')
    @Permissions('pricing:view')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '实时计算定价矩阵' })
    async calculateMatrix(
        @Body() dto: CalculatePricingDto,
    ) {
        return this.pricingService
            .calculateMatrix(dto);
    }

    @Post('commission-analysis')
    @Permissions('pricing:view')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '佣金分析' })
    async analyzeCommission(
        @Body() dto: CommissionAnalysisDto,
    ) {
        return this.pricingService
            .analyzeCommission(dto);
    }

    // ========== 方案 CRUD ==========

    @Get('plans')
    @Permissions('pricing:view')
    @ApiOperation({ summary: '定价方案列表' })
    async findAllPlans(
        @Query() query: PricingPlanQueryDto,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const result = await this.pricingService.findAllPlans(query, allowedShopIds);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: this.fieldPermissionService.stripHiddenFieldsForList(
                result.list as any[],
                PRICING_FIELD_MAP,
                state,
            ),
        };
    }

    @Get('plans/:id')
    @Permissions('pricing:view')
    @ApiOperation({ summary: '定价方案详情' })
    async findPlanById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const plan = await this.pricingService.findPlanById(id, allowedShopIds);
        const state = await this.resolveFields(user);
        return this.fieldPermissionService.stripHiddenFields(
            plan as any,
            PRICING_FIELD_MAP,
            state,
        );
    }

    @Post('plans')
    @Permissions('pricing:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '保存定价方案' })
    async savePlan(
        @Body() dto: SavePricingPlanDto,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            PRICING_FIELD_MAP,
            state,
        );
        // 定价方案的必填字段：所属链接 / 方案名称 / 利润率 / 平台佣金率
        if (
            !safe.linkId ||
            !safe.name ||
            !Array.isArray(safe.profitRates) ||
            safe.profitRates.length === 0 ||
            safe.commissionRate === undefined
        ) {
            throw new ForbiddenException('保存定价方案所需的必填字段没有编辑权限');
        }
        return this.pricingService.savePlan(
            safe as SavePricingPlanDto,
            user.sub,
            allowedShopIds,
        );
    }

    @Patch('plans/:id')
    @Permissions('pricing:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新定价方案' })
    async updatePlan(
        @Param('id') id: string,
        @Body() dto: UpdatePricingPlanDto,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            PRICING_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有定价方案字段的编辑权限');
        }
        return this.pricingService.updatePlan(
            id,
            safe as UpdatePricingPlanDto,
            user.sub,
            allowedShopIds,
        );
    }

    @Delete('plans/:id')
    @Permissions('pricing:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除定价方案' })
    async deletePlan(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const allowedShopIds = await this.resolveShopIds(user);
        await this.pricingService.deletePlan(id, user.sub, allowedShopIds);
    }
}
