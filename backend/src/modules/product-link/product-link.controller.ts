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
import { ProductLinkService } from './product-link.service';
import {
    QueryProductLinkDto,
    CreateProductLinkDto,
    UpdateProductLinkDto,
} from './dto/product-link.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('链接管理')
@Controller('business/product-links')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ProductLinkController {
    constructor(
        private readonly service: ProductLinkService,
    ) {}

    // ========== 辅助接口 ==========

    @Get('select/shops')
    @Permissions('product-link:view')
    @ApiOperation({ summary: '获取店铺选择列表' })
    async getShopsForSelect() {
        return this.service.getShopsForSelect();
    }

    // ========== CRUD ==========

    @Get()
    @Permissions('product-link:view')
    @ApiOperation({ summary: '获取链接列表' })
    async findAll(
        @Query() query: QueryProductLinkDto,
    ) {
        return this.service.findAll(query);
    }

    @Get(':id')
    @Permissions('product-link:view')
    @ApiOperation({ summary: '获取链接详情' })
    async findById(@Param('id') id: string) {
        return this.service.findById(id);
    }

    @Post()
    @Permissions('product-link:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '创建链接' })
    async create(
        @Body() dto: CreateProductLinkDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.service.create(dto, userId);
    }

    @Patch(':id')
    @Permissions('product-link:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新链接' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateProductLinkDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.service.update(id, dto, userId);
    }

    @Delete(':id')
    @Permissions('product-link:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除链接' })
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.service.delete(id, userId);
    }

    @Put('reorder')
    @Permissions('product-link:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量更新链接排序' })
    async reorder(@Body() body: { ids: string[] }) {
        return this.service.reorderProductLinks(body.ids);
    }
}
