import { Module } from '@nestjs/common';
import { ConsumableService } from './consumable.service';
import {
    ConsumableController,
    ConsumableSupplierController,
} from './consumable.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [
        ConsumableController,
        ConsumableSupplierController,
    ],
    providers: [ConsumableService],
    exports: [ConsumableService],
})
export class ConsumableModule {}
