import { Module } from '@nestjs/common';
import { ConsumableService } from './consumable.service';
import {
    ConsumableController,
    ConsumableSupplierController,
} from './consumable.controller';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';
import { CostModule } from '../cost/cost.module';

@Module({
    imports: [AuthModule, RoleModule, CostModule],
    controllers: [
        ConsumableController,
        ConsumableSupplierController,
    ],
    providers: [ConsumableService],
    exports: [ConsumableService],
})
export class ConsumableModule {}
