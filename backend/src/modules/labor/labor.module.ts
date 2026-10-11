import { Module } from '@nestjs/common';
import { LaborService } from './labor.service';
import { LaborController } from './labor.controller';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';

@Module({
    imports: [AuthModule, RoleModule],
    controllers: [LaborController],
    providers: [LaborService],
    exports: [LaborService],
})
export class LaborModule {}
