import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { AIModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';
import { StorageModule } from '../storage/storage.module';
import { PurchaseReceiptController } from './purchase-receipt.controller';
import { PurchaseReceiptService } from './purchase-receipt.service';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        RoleModule,
        StorageModule,
        AIModule,
    ],
    controllers: [PurchaseReceiptController],
    providers: [PurchaseReceiptService],
    exports: [PurchaseReceiptService],
})
export class PurchaseReceiptModule {}
