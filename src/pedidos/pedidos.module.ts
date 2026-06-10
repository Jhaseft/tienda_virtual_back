import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [PedidosController],
  providers: [PedidosService],
})
export class PedidosModule {}
