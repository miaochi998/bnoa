import { Module } from '@nestjs/common';
import { RoleModule } from '../role/role.module';
import { ProductLinkService } from './product-link.service';
import { ProductLinkController } from './product-link.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule, RoleModule],
    controllers: [ProductLinkController],
    providers: [ProductLinkService],
    exports: [ProductLinkService],
})
export class ProductLinkModule {}
