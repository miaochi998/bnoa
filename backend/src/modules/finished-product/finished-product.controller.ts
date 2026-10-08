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
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('成品管理')
@Controller('business/finished-products')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class FinishedProductController {
    constructor(
        private readonly service: FinishedProductService,
    ) {}

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
    ) {
        return this.service.findAll(query);
    }

    @Get(':id')
    @Permissions('finished-product:view')
    @ApiOperation({ summary: '获取成品详情' })
    async findById(@Param('id') id: string) {
        return this.service.findById(id);
    }

    @Post()
    @Permissions('finished-product:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '创建成品' })
    async create(
        @Body() dto: CreateFinishedProductDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.service.create(dto, userId);
    }

    @Patch(':id')
    @Permissions('finished-product:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新成品' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateFinishedProductDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.service.update(id, dto, userId);
    }

    @Delete(':id')
    @Permissions('finished-product:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除成品' })
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.service.delete(id, userId);
    }

    @Post(':id/recalculate')
    @Permissions('finished-product:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '重算成品成本' })
    async recalculate(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.service.recalculate(id, userId);
    }

    @Put('reorder')
    @Permissions('finished-product:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量更新成品排序' })
    async reorder(@Body() body: { ids: string[] }) {
        return this.service.reorderFinishedProducts(body.ids);
    }
}
