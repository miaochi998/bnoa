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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ExpressService } from './express.service';
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('快递管理')
@Controller('business/express')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ExpressController {
    constructor(private readonly expressService: ExpressService) {}

    // ========== 快递公司管理 ==========

    @Get('companies')
    @Permissions('express:view')
    async findAllCompanies(
        @Query() query: QueryExpressCompanyDto,
    ) {
        return this.expressService.findAllCompanies(query);
    }

    @Get('companies/select')
    @Permissions('express:view')
    async findAllCompaniesForSelect() {
        return this.expressService.findAllCompaniesForSelect();
    }

    @Get('companies/:id')
    @Permissions('express:view')
    async findCompanyById(@Param('id') id: string) {
        return this.expressService.findCompanyById(id);
    }

    @Post('companies')
    @Permissions('express:create')
    @HttpCode(HttpStatus.OK)
    async createCompany(
        @Body() dto: CreateExpressCompanyDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.expressService.createCompany(dto, userId);
    }

    @Patch('companies/:id')
    @Permissions('express:update')
    @HttpCode(HttpStatus.OK)
    async updateCompany(
        @Param('id') id: string,
        @Body() dto: UpdateExpressCompanyDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.expressService.updateCompany(id, dto, userId);
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
    async findZonesByCompanyId(@Param('id') id: string) {
        return this.expressService.findZonesByCompanyId(id);
    }

    @Patch('zones/:id')
    @Permissions('express:update')
    @HttpCode(HttpStatus.OK)
    async updateZone(
        @Param('id') id: string,
        @Body() dto: UpdateZoneDto,
    ) {
        return this.expressService.updateZone(id, dto);
    }

    @Patch('companies/:id/zones/batch')
    @Permissions('express:update')
    @HttpCode(HttpStatus.OK)
    async batchUpdateZones(
        @Param('id') id: string,
        @Body() dto: BatchUpdateZonesDto,
    ) {
        return this.expressService.batchUpdateZones(id, dto);
    }

    // ========== 重量段管理 ==========

    @Get('companies/:id/weight-ranges')
    @Permissions('express:view')
    async findWeightRangesByCompanyId(
        @Param('id') id: string,
    ) {
        return this.expressService.findWeightRangesByCompanyId(id);
    }

    @Patch('weight-ranges/:id')
    @Permissions('express:update')
    @HttpCode(HttpStatus.OK)
    async updateWeightRange(
        @Param('id') id: string,
        @Body() dto: UpdateWeightRangeDto,
    ) {
        return this.expressService.updateWeightRange(id, dto);
    }

    // ========== 价格矩阵管理 ==========

    @Get('companies/:id/prices/matrix')
    @Permissions('express:view')
    async findPriceMatrix(@Param('id') id: string) {
        return this.expressService.findPriceMatrix(id);
    }

    @Patch('companies/:id/prices/batch')
    @Permissions('express:update')
    @HttpCode(HttpStatus.OK)
    async batchUpdatePrices(
        @Param('id') id: string,
        @Body() dto: BatchUpdatePricesDto,
    ) {
        return this.expressService.batchUpdatePrices(id, dto);
    }

    @Post('companies/:id/prices/copy')
    @Permissions('express:update')
    @HttpCode(HttpStatus.OK)
    async copyPrices(
        @Param('id') id: string,
        @Body() dto: CopyPricesDto,
    ) {
        return this.expressService.copyPrices(id, dto);
    }

    // ========== 附加费管理 ==========

    @Get('companies/:id/surcharges')
    @Permissions('express:view')
    async findSurchargesByCompanyId(
        @Param('id') id: string,
    ) {
        return this.expressService.findSurchargesByCompanyId(id);
    }

    @Post('companies/:id/surcharges')
    @Permissions('express:update')
    @HttpCode(HttpStatus.OK)
    async createSurcharge(
        @Param('id') id: string,
        @Body() dto: CreateSurchargeDto,
    ) {
        return this.expressService.createSurcharge(id, dto);
    }

    @Patch('surcharges/:id')
    @Permissions('express:update')
    @HttpCode(HttpStatus.OK)
    async updateSurcharge(
        @Param('id') id: string,
        @Body() dto: UpdateSurchargeDto,
    ) {
        return this.expressService.updateSurcharge(id, dto);
    }

    @Delete('surcharges/:id')
    @Permissions('express:update')
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
    ) {
        return this.expressService.calculateCost(dto);
    }
}
