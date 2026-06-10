import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { ShippingZonesService } from './shipping-zones.service';

@Module({
  imports: [AuthModule, SystemConfigModule],
  controllers: [StoresController],
  providers: [StoresService, ShippingZonesService],
  exports: [StoresService, ShippingZonesService],
})
export class StoresModule {}
