import {
    Controller,
    Post,
    Body,
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
import {
    CurrentUser,
    UserPayload,
} from '../../../common/decorators/current-user.decorator';
import { AIService } from '../services/ai.service';
import { GenerateContentDto } from '../dto/generate-content.dto';
import { Message } from '../interfaces/ai-service.interface';

/**
 * AI 内容生成
 *
 * 2026-10-12 补锁：此前类级只挂 JwtAuthGuard、`POST /ai/generate` 无任何权限码，
 * 任意登录用户都可无限制消耗付费大模型额度。
 * 现要求 ai:use（该码在迁移 20261012120000 中已授予现有角色）。
 */
@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions('ai:use')
@ApiBearerAuth()
export class AIController {
    constructor(private readonly aiService: AIService) {}

    @Post('generate')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'AI内容生成' })
    @ApiResponse({ status: 200, description: '生成成功' })
    async generate(
        @Body() dto: GenerateContentDto,
        @CurrentUser() user: UserPayload,
    ) {
        const messages: Message[] = dto.messages.map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
        }));

        const result = await this.aiService.generateContent(
            dto.modelName,
            messages,
            user.sub,
            dto.options,
        );

        return {
            success: true,
            message: 'success',
            data: result,
        };
    }
}
