import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MailModule } from 'src/mail/mail.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  imports: [MailModule, NotificationsModule],
})
export class OrdersModule {}
