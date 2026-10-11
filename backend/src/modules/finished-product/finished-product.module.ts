import { Module } from '@nestjs/common';
import { FinishedProductService } from './finished-product.service';
import { FinishedProductController } from './finished-product.controller';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';

@Module({
    imports: [AuthModule, RoleModule],
    controllers: [FinishedProductController],
    providers: [FinishedProductService],
    exports: [FinishedProductService],
})
export class FinishedProductModule {}
