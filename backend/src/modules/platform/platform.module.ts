import { Module } from '@nestjs/common';
import { RoleModule } from '../role/role.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
