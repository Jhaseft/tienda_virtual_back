import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BanecoQrModule } from '../baneco-qr/baneco-qr.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [AuthModule, SystemConfigModule, BanecoQrModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
