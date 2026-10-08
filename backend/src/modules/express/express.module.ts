import { Module } from '@nestjs/common';
import { ExpressService } from './express.service';
import { ExpressController } from './express.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [ExpressController],
    providers: [ExpressService],
    exports: [ExpressService],
})
export class ExpressModule {}
