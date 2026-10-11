import { Module } from '@nestjs/common';
import { ConsumableService } from './consumable.service';
import {
    ConsumableController,
    ConsumableSupplierController,
} from './consumable.controller';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';

@Module({
    imports: [AuthModule, RoleModule],
    controllers: [
        ConsumableController,
        ConsumableSupplierController,
    ],
    providers: [ConsumableService],
    exports: [ConsumableService],
})
export class ConsumableModule {}
