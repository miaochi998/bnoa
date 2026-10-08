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
export class OpenRouterService implements IAIService {
    private readonly logger = new Logger(OpenRouterService.name);
    private client: OpenAI | null = null;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>(
            'OPENROUTER_API_KEY',
        );
        if (apiKey) {
            this.client = new OpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey,
                defaultHeaders: {
                    'HTTP-Referer': 'https://bnoa.local',
                    'X-Title': 'BNOA AI Assistant',
                },
            });
        }
    }

    getServiceName(): string {
        return 'openrouter';
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
            options?.apiEndpoint || 'https://openrouter.ai/api/v1';

        const client = apiKey
            ? new OpenAI({
                baseURL,
                apiKey,
                defaultHeaders: {
                    'HTTP-Referer': 'https://bnoa.local',
                    'X-Title': 'BNOA AI Assistant',
                },
            })
            : this.client;

        if (!client) {
            throw new Error('OpenRouter API Key 未配置');
        }

        const modelId =
            options?.modelId || 'deepseek/deepseek-chat-v3-0324';

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
                `OpenRouter 调用失败: ${error.message}`,
                error.stack,
            );
            throw new Error(`AI 服务调用失败: ${error.message}`);
        }
    }
}
