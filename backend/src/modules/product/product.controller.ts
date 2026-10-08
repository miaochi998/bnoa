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
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProductService } from './product.service';
import {
    CreateProductDto,
    UpdateProductDto,
    ProductQueryDto,
} from './dto/product.dto';

@ApiTags('产品管理')
@Controller('business/products')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ProductController {
    constructor(
        private readonly productService: ProductService,
    ) {}

    @Get()
    @Permissions('product:view')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取产品列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async findAll(@Query() query: ProductQueryDto) {
        return await this.productService.findAll(query);
    }

    @Get('brands/list')
    @Permissions('product:view')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取品牌列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getBrands() {
        return await this.productService.getBrands();
    }

    @Get('next-code')
    @Permissions('product:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取下一个产品编码（新增时默认自动填充）' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getNextCode() {
        const code = await this.productService.getNextProductCode();
        return { code };
    }

    @Get(':id')
    @Permissions('product:view')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取产品详情' })
    @ApiResponse({ status: 200, description: '获取成功' })
    @ApiResponse({ status: 404, description: '产品不存在' })
    async findById(@Param('id') id: string) {
        return await this.productService.findById(id);
    }

    @Post()
    @Permissions('product:create')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '创建产品' })
    @ApiResponse({ status: 200, description: '创建成功' })
    @ApiResponse({ status: 409, description: '产品编码已存在' })
    async create(
        @Body() dto: CreateProductDto,
        @CurrentUser('userId') userId: string,
    ) {
        return await this.productService.create(dto, userId);
    }

    @Patch(':id')
    @Permissions('product:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新产品' })
    @ApiResponse({ status: 200, description: '更新成功' })
    @ApiResponse({ status: 404, description: '产品不存在' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateProductDto,
        @CurrentUser('userId') userId: string,
    ) {
        return await this.productService.update(id, dto, userId);
    }

    @Delete(':id')
    @Permissions('product:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除产品' })
    @ApiResponse({ status: 200, description: '删除成功' })
    @ApiResponse({ status: 404, description: '产品不存在' })
    @ApiResponse({ status: 409, description: '存在关联数据' })
    async delete(
        @Param('id') id: string,
        @CurrentUser('userId') userId: string,
    ) {
        await this.productService.delete(id, userId);
    }

    @Put('reorder')
    @Permissions('product:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量更新产品排序' })
    @ApiResponse({ status: 200, description: '排序更新成功' })
    async reorder(@Body() body: { ids: string[] }) {
        return this.productService.reorderProducts(body.ids);
    }
}
