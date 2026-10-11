import { Module } from '@nestjs/common';
import { RoleModule } from '../role/role.module';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule, RoleModule],
    controllers: [PricingController],
    providers: [PricingService],
    exports: [PricingService],
})
export class PricingModule {}
