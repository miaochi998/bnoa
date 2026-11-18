import { forwardRef, Module } from '@nestjs/common';
import { FinishedProductModule } from '../finished-product/finished-product.module';
import { SkuModule } from '../sku/sku.module';
import { CostRecalcService } from './cost-recalc.service';

@Module({
  imports: [
    forwardRef(() => FinishedProductModule),
    forwardRef(() => SkuModule),
  ],
  providers: [CostRecalcService],
  exports: [CostRecalcService],
})
export class CostModule {}
