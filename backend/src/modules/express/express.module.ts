import { Module, forwardRef } from '@nestjs/common';
import { RoleModule } from '../role/role.module';
import { ExpressService } from './express.service';
import { ExpressController } from './express.controller';
import { AuthModule } from '../auth/auth.module';
import { CostModule } from '../cost/cost.module';

@Module({
    imports: [
        AuthModule,
        RoleModule,
        forwardRef(() => CostModule),
    ],
    controllers: [ExpressController],
    providers: [ExpressService],
    exports: [ExpressService],
})
export class ExpressModule {}
