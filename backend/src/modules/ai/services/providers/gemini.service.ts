import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    IAIService,
    Message,
    GenerateOptions,
    AIResponse,
} from '../../interfaces/ai-service.interface';

@Injectable()
export class GeminiService implements IAIService {
    private readonly logger = new Logger(GeminiService.name);
    private genAI: GoogleGenerativeAI | null = null;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    getServiceName(): string {
        return 'google';
    }

    async isAvailable(): Promise<boolean> {
        return !!this.genAI;
    }

    async generateContent(
        messages: Message[],
        options?: GenerateOptions,
    ): Promise<AIResponse> {
        const apiKey = options?.apiKey;
        const client = apiKey
            ? new GoogleGenerativeAI(apiKey)
            : this.genAI;

        if (!client) {
            throw new Error('Gemini API Key 未配置');
        }

        const modelId = options?.modelId || 'gemini-2.5-flash';
        const model = client.getGenerativeModel({ model: modelId });

        const prompt = messages
            .map((m) => {
                const prefix =
                    m.role === 'user'
                        ? '用户'
                        : m.role === 'assistant'
                            ? 'AI'
                            : '系统';
                return `${prefix}: ${m.content}`;
            })
            .join('\n\n');

        try {
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: options?.temperature ?? 0.7,
                    maxOutputTokens: options?.maxTokens ?? 2000,
                    topP: options?.topP ?? 0.9,
                },
            });

            const response = result.response;
            const text = response.text();
            const usage = response.usageMetadata;

            return {
                content: text,
                model: modelId,
                usage: usage
                    ? {
                        promptTokens: usage.promptTokenCount || 0,
                        completionTokens: usage.candidatesTokenCount || 0,
                        totalTokens: usage.totalTokenCount || 0,
                    }
                    : undefined,
                finishReason: 'stop',
            };
        } catch (error: any) {
            if (error?.status === 429) {
                throw new Error('AI 调用过于频繁，请稍后再试');
            }
            this.logger.error(
                `Gemini 调用失败: ${error.message}`,
                error.stack,
            );
            throw new Error(`AI 服务调用失败: ${error.message}`);
        }
    }
}
