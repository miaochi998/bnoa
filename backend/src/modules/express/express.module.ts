import { Module } from '@nestjs/common';
import { RoleModule } from '../role/role.module';
import { ExpressService } from './express.service';
import { ExpressController } from './express.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule, RoleModule],
    controllers: [ExpressController],
    providers: [ExpressService],
    exports: [ExpressService],
})
export class ExpressModule {}
