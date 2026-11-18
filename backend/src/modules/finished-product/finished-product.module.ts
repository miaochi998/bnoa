import { Module, forwardRef } from '@nestjs/common';
import { FinishedProductService } from './finished-product.service';
import { FinishedProductController } from './finished-product.controller';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';
import { CostModule } from '../cost/cost.module';

@Module({
    imports: [
        AuthModule,
        RoleModule,
        forwardRef(() => CostModule),
    ],
    controllers: [FinishedProductController],
    providers: [FinishedProductService],
    exports: [FinishedProductService],
})
export class FinishedProductModule {}
