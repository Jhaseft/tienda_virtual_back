import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ExplorarTiendaModule } from './explorarTienda/explorarTienda.module';
import { MailModule } from './mail/mail.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma.module';
import { UsersModule } from './users/users.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    WhatsappModule,
    MailModule,
    AuthModule,
    UsersModule,
    ExplorarTiendaModule,
    OrdersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
