import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { GetOrdersDto } from './dto/get-orders.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Admin: gestión de pedidos de la tienda ───────────────────────────
  @Get('admin')
  @ApiOperation({ summary: 'Listar pedidos de la tienda autenticada' })
  getAdminOrders(@CurrentUser() user: JwtUser, @Query() query: OrderQueryDto) {
    return this.ordersService.getAdminOrders(user.userId, query);
  }

  @Get('admin/:id')
  @ApiOperation({ summary: 'Obtener detalle de pedido de la tienda' })
  getAdminOrderById(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.ordersService.getAdminOrderById(user.userId, id);
  }

  @Patch('admin/:id/status')
  @ApiOperation({ summary: 'Actualizar estado de pedido (admin)' })
  updateAdminOrderStatus(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateAdminOrderStatus(user.userId, id, dto.status);
  }

  // ── Cliente: ver sus propios pedidos ─────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Listar pedidos del cliente autenticado' })
  getOrders(@CurrentUser() user: JwtUser, @Query() dto: GetOrdersDto) {
    return this.ordersService.getOrders(user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un pedido (solo el dueño puede verlo)' })
  getOrderById(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.ordersService.getOrderById(id, user.userId);
  }
}
