import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Body,
    Param,
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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AIModelService } from '../services/ai-model.service';
import {
    CreateModelDto,
    UpdateModelDto,
    ToggleModelDto,
} from '../dto/model.dto';

@ApiTags('ai-models')
@Controller('ai/models')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIModelController {
    constructor(
        private readonly modelService: AIModelService,
    ) {}

    /**
     * 获取已启用的模型列表（普通用户，面板用）
     * 不返回敏感config信息
     */
    @Get('enabled')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取已启用模型列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getEnabledModels() {
        const models =
            await this.modelService.getEnabledModels();
        const data = models.map((m) => ({
            id: m.id,
            name: m.name,
            displayName: m.displayName,
            provider: m.provider,
            isFree: m.isFree,
            isDefault: m.isDefault,
        }));
        return {
            success: true,
            message: 'success',
            data,
        };
    }

    /**
     * 获取所有模型列表（管理员，系统设置用）
     * config 中的 apiKey 脱敏
     */
    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取所有模型列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getAllModels() {
        const models = await this.modelService.getAllModels();
        const data = models.map((m) => ({
            ...m,
            config: this.modelService.maskConfig(m.config),
        }));
        return {
            success: true,
            message: 'success',
            data,
        };
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取模型详情' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getModel(@Param('id') id: string) {
        const model = await this.modelService.getModelById(id);
        return {
            success: true,
            message: 'success',
            data: {
                ...model,
                config: this.modelService.maskConfig(
                    model.config,
                ),
            },
        };
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: '创建模型' })
    @ApiResponse({ status: 201, description: '创建成功' })
    async createModel(@Body() dto: CreateModelDto) {
        const model = await this.modelService.createModel(dto);
        return {
            success: true,
            message: '模型创建成功',
            data: {
                ...model,
                config: this.modelService.maskConfig(
                    model.config,
                ),
            },
        };
    }

    @Put(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '更新模型' })
    @ApiResponse({ status: 200, description: '更新成功' })
    async updateModel(
        @Param('id') id: string,
        @Body() dto: UpdateModelDto,
    ) {
        const model = await this.modelService.updateModel(
            id,
            dto,
        );
        return {
            success: true,
            message: '模型更新成功',
            data: {
                ...model,
                config: this.modelService.maskConfig(
                    model.config,
                ),
            },
        };
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '删除模型' })
    @ApiResponse({ status: 200, description: '删除成功' })
    async deleteModel(@Param('id') id: string) {
        await this.modelService.deleteModel(id);
        return {
            success: true,
            message: '模型删除成功',
        };
    }

    @Patch(':id/toggle')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '启用/禁用模型' })
    @ApiResponse({ status: 200, description: '操作成功' })
    async toggleModel(
        @Param('id') id: string,
        @Body() dto: ToggleModelDto,
    ) {
        const model = await this.modelService.toggleModel(
            id,
            dto.isEnabled,
        );
        return {
            success: true,
            message: `模型已${dto.isEnabled ? '启用' : '禁用'}`,
            data: {
                ...model,
                config: this.modelService.maskConfig(
                    model.config,
                ),
            },
        };
    }
}
