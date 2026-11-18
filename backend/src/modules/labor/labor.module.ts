import { Module } from '@nestjs/common';
import { LaborService } from './labor.service';
import { LaborController } from './labor.controller';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';
import { CostModule } from '../cost/cost.module';

@Module({
    imports: [AuthModule, RoleModule, CostModule],
    controllers: [LaborController],
    providers: [LaborService],
    exports: [LaborService],
})
export class LaborModule {}
