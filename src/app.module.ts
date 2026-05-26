import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    PrismaModule,
    
    WhatsappModule,
    
    MailModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
