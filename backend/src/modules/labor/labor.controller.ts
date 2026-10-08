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
import { LaborService } from './labor.service';
import {
    QueryLaborTypeDto,
    CreateLaborTypeDto,
    UpdateLaborTypeDto,
    CreateLaborRateDto,
    UpdateLaborRateDto,
} from './dto/labor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('工费管理')
@Controller('business/labor/types')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class LaborController {
    constructor(
        private readonly laborService: LaborService,
    ) {}

    // ========== 工种管理 ==========

    @Get()
    @Permissions('labor:view')
    async findAll(@Query() query: QueryLaborTypeDto) {
        return this.laborService.findAllTypes(query);
    }

    @Get(':id')
    @Permissions('labor:view')
    async findById(@Param('id') id: string) {
        return this.laborService.findTypeById(id);
    }

    @Post()
    @Permissions('labor:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateLaborTypeDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.laborService.createType(dto, userId);
    }

    @Patch(':id')
    @Permissions('labor:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateLaborTypeDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.laborService.updateType(
            id, dto, userId,
        );
    }

    @Delete(':id')
    @Permissions('labor:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.laborService.deleteType(id, userId);
    }

    // ========== 工费标准 ==========

    @Get(':id/rates')
    @Permissions('labor:view')
    async findRates(@Param('id') id: string) {
        return this.laborService.findRatesByTypeId(id);
    }

    @Post(':id/rates')
    @Permissions('labor:update')
    @HttpCode(HttpStatus.OK)
    async createRate(
        @Param('id') id: string,
        @Body() dto: CreateLaborRateDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.laborService.createRate(
            id, dto, userId,
        );
    }

    @Patch(':id/rates/:rateId/set-current')
    @Permissions('labor:update')
    @HttpCode(HttpStatus.OK)
    async setCurrentRate(
        @Param('id') id: string,
        @Param('rateId') rateId: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.laborService.setCurrentRate(
            id, rateId, userId,
        );
    }

    @Patch(':id/rates/:rateId')
    @Permissions('labor:update')
    @HttpCode(HttpStatus.OK)
    async updateRate(
        @Param('id') id: string,
        @Param('rateId') rateId: string,
        @Body() dto: UpdateLaborRateDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.laborService.updateRate(
            id, rateId, dto, userId,
        );
    }

    @Delete(':id/rates/:rateId')
    @Permissions('labor:delete')
    @HttpCode(HttpStatus.OK)
    async deleteRate(
        @Param('id') id: string,
        @Param('rateId') rateId: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.laborService.deleteRate(
            id, rateId, userId,
        );
    }

    @Put('reorder')
    @Permissions('labor:update')
    @HttpCode(HttpStatus.OK)
    async reorder(@Body() body: { ids: string[] }) {
        return this.laborService.reorderLaborTypes(body.ids);
    }
}
