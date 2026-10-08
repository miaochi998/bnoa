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
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('耗材管理')
@Controller('business/consumables')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ConsumableController {
    constructor(
        private readonly consumableService: ConsumableService,
    ) {}

    // ========== 耗材管理 ==========

    @Get()
    @Permissions('consumable:view')
    async findAll(@Query() query: QueryConsumableDto) {
        return this.consumableService.findAllConsumables(query);
    }

    @Get(':id')
    @Permissions('consumable:view')
    async findById(@Param('id') id: string) {
        return this.consumableService.findConsumableById(id);
    }

    @Post()
    @Permissions('consumable:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateConsumableDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.consumableService.createConsumable(
            dto, userId,
        );
    }

    @Patch(':id')
    @Permissions('consumable:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateConsumableDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.consumableService.updateConsumable(
            id, dto, userId,
        );
    }

    @Delete(':id')
    @Permissions('consumable:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.consumableService.deleteConsumable(
            id, userId,
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
    async findPrices(@Param('id') id: string) {
        return this.consumableService
            .findPricesByConsumableId(id);
    }

    @Post(':id/prices')
    @Permissions('consumable:update')
    @HttpCode(HttpStatus.OK)
    async createPrice(
        @Param('id') id: string,
        @Body() dto: CreateConsumablePriceDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.consumableService.createPrice(
            id, dto, userId,
        );
    }

    @Patch(':id/prices/:priceId/set-current')
    @Permissions('consumable:update')
    @HttpCode(HttpStatus.OK)
    async setCurrentPrice(
        @Param('id') id: string,
        @Param('priceId') priceId: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.consumableService.setCurrentPrice(
            id, priceId, userId,
        );
    }

    @Patch(':id/prices/:priceId')
    @Permissions('consumable:update')
    @HttpCode(HttpStatus.OK)
    async updatePrice(
        @Param('id') id: string,
        @Param('priceId') priceId: string,
        @Body() dto: UpdateConsumablePriceDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.consumableService.updatePrice(
            id, priceId, dto, userId,
        );
    }

    @Delete(':id/prices/:priceId')
    @Permissions('consumable:delete')
    @HttpCode(HttpStatus.OK)
    async deletePrice(
        @Param('id') id: string,
        @Param('priceId') priceId: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.consumableService.deletePrice(
            id, priceId, userId,
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
    ) {}

    @Get()
    @Permissions('consumable:view')
    async findAll(
        @Query() query: QueryConsumableSupplierDto,
    ) {
        return this.consumableService.findAllSuppliers(query);
    }

    @Get('select')
    @Permissions('consumable:view')
    async findAllForSelect() {
        return this.consumableService
            .findAllSuppliersForSelect();
    }

    @Post()
    @Permissions('consumable:create')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateConsumableSupplierDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.consumableService.createSupplier(
            dto, userId,
        );
    }

    @Patch(':id')
    @Permissions('consumable:update')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateConsumableSupplierDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.consumableService.updateSupplier(
            id, dto, userId,
        );
    }

    @Delete(':id')
    @Permissions('consumable:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.consumableService.deleteSupplier(
            id, userId,
        );
    }

    @Put('reorder')
    @Permissions('consumable:update')
    @HttpCode(HttpStatus.OK)
    async reorderSuppliers(@Body() body: { ids: string[] }) {
        return this.consumableService.reorderConsumableSuppliers(body.ids);
    }
}
