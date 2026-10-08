import { Module } from '@nestjs/common';
import { NumberCheckController } from './number-check.controller';
import { NumberCheckService } from './number-check.service';
import { PrismaModule } from '../../config/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, AuthModule, RoleModule, StorageModule],
  controllers: [NumberCheckController],
  providers: [NumberCheckService],
  exports: [NumberCheckService],
})
export class NumberCheckModule {}
