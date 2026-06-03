import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [AuthModule, SystemConfigModule],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
