import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { MailModule } from '../mail/mail.module';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, UploadsModule, MailModule, NotificationsModule],
  controllers: [PedidosController],
  providers: [PedidosService],
})
export class PedidosModule {}
