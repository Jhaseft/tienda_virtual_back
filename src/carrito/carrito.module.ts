import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CarritoController } from './carrito.controller';
import { CarritoService } from './carrito.service';

@Module({
  imports: [AuthModule],
  controllers: [CarritoController],
  providers: [CarritoService],
})
export class CarritoModule {}
