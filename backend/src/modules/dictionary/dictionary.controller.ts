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
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { DictionaryService } from './dictionary.service';
import {
    CreateDictionaryDto,
    UpdateDictionaryDto,
    QueryDictionaryDto,
} from './dto/dictionary.dto';

@ApiTags('dictionaries')
@Controller('dictionaries')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class DictionaryController {
    constructor(
        private readonly dictionaryService: DictionaryService,
    ) {}

    /**
     * 获取字典类型列表
     */
    @Get()
    @Permissions('dictionary:list')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取字典类型列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getTypes() {
        const types = await this.dictionaryService.getTypes();
        return {
            success: true,
            message: '获取字典类型列表成功',
            data: types,
        };
    }

    /**
     * 按 typeCode 获取条目列表
     */
    @Get('items')
    @Permissions('dictionary:list')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取字典条目列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getItems(@Query() query: QueryDictionaryDto) {
        if (query.typeCode) {
            const items =
                await this.dictionaryService.getItemsByType(
                    query.typeCode,
                );
            return {
                success: true,
                message: '获取字典条目成功',
                data: items,
            };
        }
        return {
            success: true,
            message: '请提供 typeCode',
            data: [],
        };
    }

    /**
     * 批量获取字典条目（公开接口）
     */
    @Get('batch')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '批量获取字典条目' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getBatch(@Query('typeCodes') typeCodes: string) {
        if (!typeCodes) {
            return {
                success: true,
                message: '请提供 typeCodes',
                data: {},
            };
        }
        const codes = typeCodes
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);
        const data =
            await this.dictionaryService.getItemsByTypes(codes);
        return {
            success: true,
            message: '批量获取字典条目成功',
            data,
        };
    }

    /**
     * 创建字典条目
     */
    @Post()
    @Permissions('dictionary:create')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: '创建字典条目' })
    @ApiResponse({ status: 201, description: '创建成功' })
    async create(@Body() dto: CreateDictionaryDto) {
        const item = await this.dictionaryService.create(dto);
        return {
            success: true,
            message: '字典条目创建成功',
            data: item,
        };
    }

    /**
     * 更新字典条目
     */
    @Patch(':id')
    @Permissions('dictionary:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新字典条目' })
    @ApiResponse({ status: 200, description: '更新成功' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateDictionaryDto,
    ) {
        const item = await this.dictionaryService.update(id, dto);
        return {
            success: true,
            message: '字典条目更新成功',
            data: item,
        };
    }

    /**
     * 删除字典条目
     */
    @Delete(':id')
    @Permissions('dictionary:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除字典条目' })
    @ApiResponse({ status: 200, description: '删除成功' })
    async delete(@Param('id') id: string) {
        await this.dictionaryService.delete(id);
        return {
            success: true,
            message: '字典条目删除成功',
        };
    }

    /**
     * 启用/禁用字典条目
     */
    @Patch(':id/toggle')
    @Permissions('dictionary:update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '启用/禁用字典条目' })
    @ApiResponse({ status: 200, description: '操作成功' })
    async toggle(@Param('id') id: string) {
        const item = await this.dictionaryService.toggle(id);
        return {
            success: true,
            message: item.isActive
                ? '字典条目已启用'
                : '字典条目已禁用',
            data: item,
        };
    }
}
