export type MessageContentPart =
    | { type: 'text'; text: string }
    | { type: 'image'; mimeType: string; data: string };

export interface Message {
    role: 'system' | 'user' | 'assistant';
    /** 纯文本，或多模态内容数组（文本 + 图片 base64） */
    content: string | MessageContentPart[];
}

export interface GenerateOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    apiKey?: string;
    modelId?: string;
    apiEndpoint?: string;
}

export interface AIResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason?: string;
}

export interface IAIService {
    generateContent(
        messages: Message[],
        options?: GenerateOptions,
    ): Promise<AIResponse>;
    isAvailable(): Promise<boolean>;
    getServiceName(): string;
}
