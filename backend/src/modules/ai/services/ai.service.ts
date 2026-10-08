import {
    Injectable,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { AIModelService } from './ai-model.service';
import { GeminiService } from './providers/gemini.service';
import { OpenRouterService } from './providers/openrouter.service';
import { DeepSeekService } from './providers/deepseek.service';
import {
    IAIService,
    Message,
    AIResponse,
} from '../interfaces/ai-service.interface';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private readonly providers = new Map<string, IAIService>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly modelService: AIModelService,
        private readonly geminiService: GeminiService,
        private readonly openRouterService: OpenRouterService,
        private readonly deepSeekService: DeepSeekService,
    ) {
        this.providers.set('google', this.geminiService);
        this.providers.set('openrouter', this.openRouterService);
        this.providers.set('deepseek', this.deepSeekService);
    }

    async generateContent(
        modelName: string,
        messages: Message[],
        userId: string,
        options?: {
            temperature?: number;
            maxTokens?: number;
            topP?: number;
        },
    ): Promise<AIResponse> {
        const startTime = Date.now();
        const actionType = this.detectActionType(messages);

        try {
            const model =
                await this.modelService.getModelByName(modelName);
            const provider = this.providers.get(model.provider);

            if (!provider) {
                throw new BadRequestException(
                    `不支持的AI提供商: ${model.provider}`,
                );
            }

            const config =
                (model.config as Record<string, any>) || {};
            const apiKey = config.apiKey || undefined;

            if (!apiKey) {
                const available = await provider.isAvailable();
                if (!available) {
                    throw new BadRequestException(
                        `模型 ${modelName} 的 API Key 未配置`,
                    );
                }
            }

            const result = await provider.generateContent(
                messages,
                {
                    apiKey,
                    modelId: model.modelId,
                    apiEndpoint: model.apiEndpoint || undefined,
                    temperature:
                        options?.temperature ??
                        config.temperature ??
                        0.7,
                    maxTokens:
                        options?.maxTokens ??
                        config.maxTokens ??
                        2000,
                    topP: options?.topP ?? config.topP ?? 0.9,
                },
            );

            const responseTime = Date.now() - startTime;
            const cost = this.calculateCost(config, result);

            // 异步记录使用日志
            this.logUsage(
                model.id,
                userId,
                actionType,
                result,
                responseTime,
                cost,
                true,
            ).catch((err) =>
                this.logger.warn(
                    `记录使用日志失败: ${err.message}`,
                ),
            );

            return result;
        } catch (error: any) {
            const responseTime = Date.now() - startTime;

            // 异步记录错误日志
            this.logUsage(
                modelName,
                userId,
                'error',
                undefined,
                responseTime,
                0,
                false,
                error.message,
            ).catch((err) =>
                this.logger.warn(
                    `记录错误日志失败: ${err.message}`,
                ),
            );

            throw error;
        }
    }

    private detectActionType(messages: Message[]): string {
        if (!messages.length) return 'custom';
        const lastMsg = messages[messages.length - 1].content;

        if (lastMsg.includes('续写') || lastMsg.includes('继续写'))
            return 'continue';
        if (lastMsg.includes('改写') || lastMsg.includes('重写'))
            return 'rewrite';
        if (lastMsg.includes('总结') || lastMsg.includes('概括'))
            return 'summarize';
        if (lastMsg.includes('检查') || lastMsg.includes('语法'))
            return 'check';

        return 'custom';
    }

    private calculateCost(
        config: Record<string, any>,
        result: AIResponse,
    ): number {
        if (!result.usage) return 0;
        const inputPrice = config.inputPrice || 0;
        const outputPrice = config.outputPrice || 0;
        return (
            (result.usage.promptTokens * inputPrice +
                result.usage.completionTokens * outputPrice) /
            1000000
        );
    }

    private async logUsage(
        modelId: string,
        userId: string,
        actionType: string,
        result?: AIResponse,
        responseTime = 0,
        cost = 0,
        success = true,
        errorMessage?: string,
    ): Promise<void> {
        await this.prisma.aiUsageLog.create({
            data: {
                modelId,
                userId,
                actionType,
                promptTokens:
                    result?.usage?.promptTokens || 0,
                completionTokens:
                    result?.usage?.completionTokens || 0,
                totalTokens:
                    result?.usage?.totalTokens || 0,
                cost: new Decimal(cost),
                responseTime,
                success,
                errorMessage,
            },
        });
    }
}
