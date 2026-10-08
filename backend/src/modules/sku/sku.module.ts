import { Module } from '@nestjs/common';
import { SkuService } from './sku.service';
import { SkuController } from './sku.controller';
import { AuthModule } from '../auth/auth.module';
import { ExpressModule } from '../express/express.module';

@Module({
  imports: [AuthModule, ExpressModule],
  controllers: [SkuController],
  providers: [SkuService],
  exports: [SkuService],
})
export class SkuModule {}
