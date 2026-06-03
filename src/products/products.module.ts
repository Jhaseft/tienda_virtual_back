import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuthModule, SystemConfigModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
