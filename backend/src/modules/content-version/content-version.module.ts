import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ContentVersionService } from './content-version.service';
import { ContentVersionController } from './content-version.controller';

@Module({
    imports: [PrismaModule, AuthModule],
    providers: [ContentVersionService],
    controllers: [ContentVersionController],
    exports: [ContentVersionService],
})
export class ContentVersionModule {}
