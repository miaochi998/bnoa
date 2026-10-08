import { Module } from '@nestjs/common';
import { LaborService } from './labor.service';
import { LaborController } from './labor.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [LaborController],
    providers: [LaborService],
    exports: [LaborService],
})
export class LaborModule {}
