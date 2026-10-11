import { Module, forwardRef } from '@nestjs/common';
import { RedisService } from '../../common/services/redis.service';
import { AuthModule } from '../auth/auth.module';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';
import { FieldPermissionModule } from '../role/field-permission.module';

@Module({
    imports: [forwardRef(() => AuthModule), FieldPermissionModule],
    controllers: [DictionaryController],
    providers: [DictionaryService, RedisService],
    exports: [DictionaryService],
})
export class DictionaryModule {}
