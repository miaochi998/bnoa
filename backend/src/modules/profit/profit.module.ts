import { Module } from '@nestjs/common';
import { ProfitController } from './profit.controller';
import { ProfitService } from './profit.service';
import { ProfitImportService } from './profit-import.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [ProfitController],
    providers: [ProfitService, ProfitImportService],
    exports: [ProfitService],
})
export class ProfitModule {}
