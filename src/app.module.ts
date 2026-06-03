import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { ExplorarTiendaModule } from './explorarTienda/explorarTienda.module';
import { MailModule } from './mail/mail.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma.module';
import { ProductsModule } from './products/products.module';
import { StatsModule } from './stats/stats.module';
import { StoresModule } from './stores/stores.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { StripeModule } from './stripe/stripe.module';
import { BanecoQrModule } from './baneco-qr/baneco-qr.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { UploadsModule } from './uploads/uploads.module';
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
    CustomersModule,
    ProductsModule,
    StatsModule,
    StoresModule,
    PlansModule,
    SystemConfigModule,
    SubscriptionsModule,
    StripeModule,
    BanecoQrModule,
    UploadsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
