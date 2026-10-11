import { Module } from '@nestjs/common';
import { RoleModule } from '../role/role.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
