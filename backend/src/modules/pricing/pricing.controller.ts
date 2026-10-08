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
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PricingService } from './pricing.service';
import {
    CalculatePricingDto,
    CommissionAnalysisDto,
    SavePricingPlanDto,
    UpdatePricingPlanDto,
    PricingPlanQueryDto,
} from './dto/pricing.dto';

@ApiTags('定价计算')
@Controller('business/pricing')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PricingController {
    constructor(
        private readonly pricingService: PricingService,
    ) {}

    // ========== 辅助接口 ==========

    @Get('select/links')
    @Permissions('pricing:view')
    @ApiOperation({ summary: '获取链接选择列表' })
    async getLinksForSelect() {
        return this.pricingService
            .getLinksForSelect();
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
    ) {
        return this.pricingService
            .findAllPlans(query);
    }

    @Get('plans/:id')
    @Permissions('pricing:view')
    @ApiOperation({ summary: '定价方案详情' })
    async findPlanById(
        @Param('id') id: string,
    ) {
        return this.pricingService
            .findPlanById(id);
    }

    @Post('plans')
    @Permissions('pricing:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '保存定价方案' })
    async savePlan(
        @Body() dto: SavePricingPlanDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.pricingService
            .savePlan(dto, userId);
    }

    @Patch('plans/:id')
    @Permissions('pricing:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新定价方案' })
    async updatePlan(
        @Param('id') id: string,
        @Body() dto: UpdatePricingPlanDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.pricingService
            .updatePlan(id, dto, userId);
    }

    @Delete('plans/:id')
    @Permissions('pricing:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除定价方案' })
    async deletePlan(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.pricingService
            .deletePlan(id, userId);
    }
}
