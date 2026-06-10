import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { CarritoService } from './carrito.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('carrito')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('carrito')
export class CarritoController {
  constructor(private readonly carritoService: CarritoService) {}

  // API ENDPOINTS PARA MANEJAR EL CARRITO DE COMPRAS DE UN USUARIO, PROTEGIDOS POR JWT AUTH GUARD
  @Get()
  @ApiOperation({ summary: 'Ver mi carrito agrupado por tienda' })
  getMyCart(@CurrentUser() user: JwtUser) {
    return this.carritoService.getMyCart(user.userId);
  }

  // API ENDPOINT PARA AGREGAR UN PRODUCTO AL CARRITO, RECIBE LOS DATOS EN EL CUERPO DE LA PETICIÓN Y ASOCIA EL ITEM AL USUARIO AUTENTICADO
  @Post()
  @ApiOperation({ summary: 'Agregar producto al carrito' })
  addToCart(@CurrentUser() user: JwtUser, @Body() dto: AddToCartDto) {
    return this.carritoService.addToCart(user.userId, dto);
  }

  // API ENDPOINT PARA ACTUALIZAR LA CANTIDAD DE UN ITEM EN EL CARRITO, RECIBE EL ID DEL ITEM A ACTUALIZAR Y LOS NUEVOS DATOS EN EL CUERPO DE LA PETICIÓN
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar cantidad de un item' })
  updateCartItem(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateCartItemDto) {
    return this.carritoService.updateCartItem(user.userId, id, dto);
  }

  // API ENDPOINT PARA ELIMINAR UN ITEM DEL CARRITO, RECIBE EL ID DEL ITEM A ELIMINAR
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar item del carrito' })
  removeCartItem(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.carritoService.removeCartItem(user.userId, id);
  }

  // API ENDPOINT PARA VACIAR EL CARRITO DE UNA TIENDA ESPECÍFICA, RECIBE EL ID DE LA TIENDA
  @Delete('tienda/:storeId')
  @ApiOperation({ summary: 'Vaciar carrito de una tienda' })
  clearStoreCart(@CurrentUser() user: JwtUser, @Param('storeId') storeId: string) {
    return this.carritoService.clearStoreCart(user.userId, storeId);
  }
}
