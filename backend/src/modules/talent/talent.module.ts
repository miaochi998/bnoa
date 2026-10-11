import { Module } from '@nestjs/common';
import { TalentService } from './talent.service';
import { TalentController } from './talent.controller';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';

@Module({
    imports: [AuthModule, RoleModule],
    controllers: [TalentController],
    providers: [TalentService],
    exports: [TalentService],
})
export class TalentModule {}
