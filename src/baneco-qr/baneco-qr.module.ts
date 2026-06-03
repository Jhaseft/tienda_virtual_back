import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { BanecoApiService } from './baneco-api.service';
import { BanecoQrController } from './baneco-qr.controller';
import { BanecoQrService } from './baneco-qr.service';

@Module({
  imports: [PrismaModule],
  controllers: [BanecoQrController],
  providers: [BanecoApiService, BanecoQrService],
  exports: [BanecoApiService, BanecoQrService],
})
export class BanecoQrModule {}
