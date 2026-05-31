import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  JwtUser,
} from '../common/decorators/current-user.decorator';
import { GetOrdersDto } from './dto/get-orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Listar pedidos del cliente autenticado con filtro opcional por estado',
  })
  getOrders(@CurrentUser() user: JwtUser, @Query() dto: GetOrdersDto) {
    return this.ordersService.getOrders(user.userId, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Detalle de un pedido (solo el dueño puede verlo)' })
  getOrderById(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.ordersService.getOrderById(id, user.userId);
  }
}
