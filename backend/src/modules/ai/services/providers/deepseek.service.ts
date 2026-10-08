import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
    IAIService,
    Message,
    GenerateOptions,
    AIResponse,
} from '../../interfaces/ai-service.interface';

@Injectable()
export class DeepSeekService implements IAIService {
    private readonly logger = new Logger(DeepSeekService.name);
    private client: OpenAI | null = null;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>(
            'DEEPSEEK_API_KEY',
        );
        if (apiKey) {
            this.client = new OpenAI({
                baseURL: 'https://api.deepseek.com',
                apiKey,
            });
        }
    }

    getServiceName(): string {
        return 'deepseek';
    }

    async isAvailable(): Promise<boolean> {
        return !!this.client;
    }

    async generateContent(
        messages: Message[],
        options?: GenerateOptions,
    ): Promise<AIResponse> {
        const apiKey = options?.apiKey;
        const baseURL =
            options?.apiEndpoint || 'https://api.deepseek.com';

        const client = apiKey
            ? new OpenAI({ baseURL, apiKey })
            : this.client;

        if (!client) {
            throw new Error('DeepSeek API Key 未配置');
        }

        const modelId = options?.modelId || 'deepseek-chat';

        try {
            const response = await client.chat.completions.create({
                model: modelId,
                messages: messages.map((m) => ({
                    role: m.role as 'system' | 'user' | 'assistant',
                    content: m.content,
                })),
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? 2000,
                top_p: options?.topP ?? 0.9,
                stream: false,
            });

            const choice = response.choices[0];
            const usage = response.usage;

            return {
                content: choice?.message?.content || '',
                model: response.model || modelId,
                usage: usage
                    ? {
                        promptTokens: usage.prompt_tokens || 0,
                        completionTokens:
                            usage.completion_tokens || 0,
                        totalTokens: usage.total_tokens || 0,
                    }
                    : undefined,
                finishReason: choice?.finish_reason || 'stop',
            };
        } catch (error: any) {
            this.logger.error(
                `DeepSeek 调用失败: ${error.message}`,
                error.stack,
            );
            throw new Error(`AI 服务调用失败: ${error.message}`);
        }
    }
}
