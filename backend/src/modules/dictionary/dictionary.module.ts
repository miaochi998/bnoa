import { Module, forwardRef } from '@nestjs/common';
import { RedisService } from '../../common/services/redis.service';
import { AuthModule } from '../auth/auth.module';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';

@Module({
    imports: [forwardRef(() => AuthModule)],
    controllers: [DictionaryController],
    providers: [DictionaryService, RedisService],
    exports: [DictionaryService],
})
export class DictionaryModule {}
