import { Module } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';
import { CostModule } from '../cost/cost.module';

@Module({
  imports: [AuthModule, RoleModule, CostModule],
  controllers: [SupplierController],
  providers: [SupplierService],
  exports: [SupplierService],
})
export class SupplierModule {}
