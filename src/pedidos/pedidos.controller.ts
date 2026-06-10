import { Body, Controller, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { UploadsService } from '../uploads/uploads.service';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';

@ApiTags('pedidos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly pedidosService: PedidosService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear pedido (comprar ahora o desde carrito)' })
  createPedido(@CurrentUser() user: JwtUser, @Body() dto: CreatePedidoDto) {
    return this.pedidosService.createPedido(user.userId, dto);
  }

  @Patch(':id/voucher')
  @ApiOperation({ summary: 'Subir comprobante de pago' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadVoucher(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadsService.uploadVoucher(user.userId, id, file);
  }
}
