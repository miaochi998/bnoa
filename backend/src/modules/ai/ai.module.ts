import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AIController } from './controllers/ai.controller';
import { AIModelController } from './controllers/ai-model.controller';
import { AIService } from './services/ai.service';
import { AIModelService } from './services/ai-model.service';
import { GeminiService } from './services/providers/gemini.service';
import { OpenRouterService } from './services/providers/openrouter.service';
import { DeepSeekService } from './services/providers/deepseek.service';

@Module({
    imports: [ConfigModule, AuthModule],
    controllers: [AIController, AIModelController],
    providers: [
        AIService,
        AIModelService,
        GeminiService,
        OpenRouterService,
        DeepSeekService,
    ],
    exports: [AIService, AIModelService],
})
export class AIModule {}
