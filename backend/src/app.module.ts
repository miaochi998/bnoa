import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './config/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { StorageModule } from './modules/storage/storage.module';
import { UploadModule } from './modules/upload/upload.module';
import { FileModule } from './modules/file/file.module';
import { ImageModule } from './modules/image/image.module';
import { RoleModule } from './modules/role/role.module';
import { ConfigModule as SystemConfigModule } from './modules/config/config.module';
import { AuditModule } from './modules/audit/audit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ContentVersionModule } from './modules/content-version/content-version.module';
import { AIModule } from './modules/ai/ai.module';
import { CaptchaModule } from './modules/captcha/captcha.module';
import { DictionaryModule } from './modules/dictionary/dictionary.module';
import { TaskModule } from './modules/task/task.module';
import { EmailModule } from './modules/email/email.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ExportImportModule } from './modules/export-import/export-import.module';
import { ConsumableModule } from './modules/consumable/consumable.module';
import { ExpressModule } from './modules/express/express.module';
import { FinishedProductModule } from './modules/finished-product/finished-product.module';
import { LaborModule } from './modules/labor/labor.module';
import { NotebookModule } from './modules/notebook/notebook.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { ProductModule } from './modules/product/product.module';
import { ProductLinkModule } from './modules/product-link/product-link.module';
import { ProfitModule } from './modules/profit/profit.module';
import { ShopModule } from './modules/shop/shop.module';
import { SkuModule } from './modules/sku/sku.module';
import { SupplierModule } from './modules/supplier/supplier.module';
import { TalentModule } from './modules/talent/talent.module';
import { UpgradeModule } from './modules/upgrade/upgrade.module';
import { BackupModule } from './modules/backup/backup.module';
import { NumberCheckModule } from './modules/number-check/number-check.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PurchaseReceiptModule } from './modules/purchase-receipt/purchase-receipt.module';
import { RedisService } from './common/services/redis.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    AuthModule,
    UserModule,
    StorageModule,
    UploadModule,
    FileModule,
    ImageModule,
    RoleModule,
    SystemConfigModule,
    AuditModule,
    DashboardModule,
    ContentVersionModule,
    AIModule,
    CaptchaModule,
    DictionaryModule,
    TaskModule,
    EmailModule,
    NotificationModule,
    ExportImportModule,
    ConsumableModule,
    ExpressModule,
    FinishedProductModule,
    LaborModule,
    NotebookModule,
    PlatformModule,
    PricingModule,
    ProductModule,
    ProductLinkModule,
    ProfitModule,
    ShopModule,
    SkuModule,
    SupplierModule,
    TalentModule,
    UpgradeModule,
    BackupModule,
    NumberCheckModule,
    PaymentModule,
    PurchaseReceiptModule,
  ],
  controllers: [AppController],
  providers: [AppService, RedisService],
  exports: [RedisService],
})
export class AppModule {}
