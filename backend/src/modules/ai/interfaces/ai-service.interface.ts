export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
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
