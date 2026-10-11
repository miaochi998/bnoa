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
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AIModelService } from '../services/ai-model.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../../common/decorators/current-user.decorator';
import {
    FieldKeyMapping,
    FieldPermissionService,
} from '../../role/field-permission.service';

/** AI 模型字段映射：用于「信息权限」读取脱敏 */
const AI_MODEL_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'name', key: 'name' },
    { field: 'displayName', key: 'displayName' },
    { field: 'provider', key: 'provider' },
    { field: 'modelId', key: 'modelId' },
    { field: 'apiEndpoint', key: 'apiEndpoint' },
    { field: 'config', key: 'config' },
    { field: 'description', key: 'description' },
    { field: 'isEnabled', key: 'isEnabled' },
    { field: 'isDefault', key: 'isDefault' },
    { field: 'isFree', key: 'isFree' },
];
import {
    CreateModelDto,
    UpdateModelDto,
    ToggleModelDto,
} from '../dto/model.dto';

@ApiTags('ai-models')
@Controller('ai/models')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AIModelController {
    constructor(
        private readonly modelService: AIModelService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'ai-model',
            user.roles ?? [],
        );
    }

    /** 递归脱敏 */
    private stripAiDeep(node: any, state: any): any {
      return this.fieldPermissionService.stripHiddenFieldsDeep(
        node,
        AI_MODEL_FIELD_MAP,
        state,
      );
    }

    /**
     * 获取已启用的模型列表（普通用户，面板用）
     * 不返回敏感config信息
     */
    @Get('enabled')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取已启用模型列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getEnabledModels(@CurrentUser() user: UserPayload) {
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
        const state = await this.resolveFields(user);
        return {
            success: true,
            message: 'success',
            data: this.stripAiDeep(data, state),
        };
    }

    /**
     * 获取所有模型列表（管理员，系统设置用）
     * config 中的 apiKey 脱敏
     */
    @Get()
    @Permissions('ai-model:manage')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取所有模型列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getAllModels(@CurrentUser() user: UserPayload) {
        const models = await this.modelService.getAllModels();
        const state = await this.resolveFields(user);
        const data = models.map((m) => ({
            ...m,
            config: this.modelService.maskConfig(m.config),
        }));
        return {
            success: true,
            message: 'success',
            data: this.stripAiDeep(data, state),
        };
    }

    @Get(':id')
    @Permissions('ai-model:manage')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '获取模型详情' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getModel(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const model = await this.modelService.getModelById(id);
        const state = await this.resolveFields(user);
        return {
            success: true,
            message: 'success',
            data: this.stripAiDeep(
                {
                    ...model,
                    config: this.modelService.maskConfig(
                        model.config,
                    ),
                },
                state,
            ),
        };
    }

    @Post()
    @Permissions('ai-model:create')
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
    @Permissions('ai-model:update')
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
    @Permissions('ai-model:delete')
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
    @Permissions('ai-model:toggle')
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
