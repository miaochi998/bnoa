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
    ApiOperation,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SkuService } from './sku.service';
import {
    CreateSkuDto,
    UpdateSkuDto,
    SkuQueryDto,
} from './dto/sku.dto';

@ApiTags('SKU管理')
@Controller('business/skus')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class SkuController {
    constructor(
        private readonly skuService: SkuService,
    ) {}

    // ========== 辅助接口 ==========

    @Get('select/links')
    @Permissions('sku:view')
    @ApiOperation({ summary: '获取链接选择列表' })
    async getLinksForSelect() {
        return this.skuService.getLinksForSelect();
    }

    @Get('select/finished-products')
    @Permissions('sku:view')
    @ApiOperation({ summary: '获取成品选择列表' })
    async getFinishedProductsForSelect() {
        return this.skuService
            .getFinishedProductsForSelect();
    }

    // ========== CRUD ==========

    @Get()
    @Permissions('sku:view')
    @ApiOperation({ summary: '获取SKU列表' })
    async findAll(@Query() query: SkuQueryDto) {
        return this.skuService.findAll(query);
    }

    @Get(':id')
    @Permissions('sku:view')
    @ApiOperation({ summary: '获取SKU详情' })
    async findById(@Param('id') id: string) {
        return this.skuService.findById(id);
    }

    @Post()
    @Permissions('sku:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '创建SKU' })
    async create(
        @Body() dto: CreateSkuDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.skuService.create(dto, userId);
    }

    @Patch(':id')
    @Permissions('sku:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新SKU' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateSkuDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.skuService.update(id, dto, userId);
    }

    @Post(':id/recalculate')
    @Permissions('sku:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '重算SKU成本' })
    async recalculate(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.skuService.recalculate(id, userId);
    }

    @Delete(':id')
    @Permissions('sku:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除SKU' })
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.skuService.delete(id, userId);
    }

    @Put('reorder')
    @Permissions('sku:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量更新SKU排序' })
    async reorder(@Body() body: { ids: string[] }) {
        return this.skuService.reorderSkus(body.ids);
    }
}
