import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateSubdomainDto } from './dto/update-subdomain.dto';
import { StoresService } from './stores.service';

@ApiTags('stores')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @ApiOperation({ summary: 'Crear mi tienda' })
  createStore(@CurrentUser() user: JwtUser, @Body() dto: CreateStoreDto) {
    return this.storesService.createStore(user.userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Obtener configuracion de mi tienda' })
  getStoreSettings(@CurrentUser() user: JwtUser) {
    return this.storesService.getStoreSettings(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar configuracion principal de tienda' })
  updateStoreSettings(@CurrentUser() user: JwtUser, @Body() dto: UpdateStoreDto) {
    return this.storesService.updateStoreSettings(user.userId, dto);
  }

  @Patch('me/subdomain')
  @ApiOperation({ summary: 'Asignar/actualizar subdominio de mi tienda' })
  updateStoreSubdomain(@CurrentUser() user: JwtUser, @Body() dto: UpdateSubdomainDto) {
    return this.storesService.updateStoreSubdomain(user.userId, dto);
  }

  @Patch('me/payment-method')
  @ApiOperation({ summary: 'Actualizar o crear metodo de pago de mi tienda' })
  updateStorePaymentMethod(@CurrentUser() user: JwtUser, @Body() dto: UpdatePaymentMethodDto) {
    return this.storesService.updateStorePaymentMethod(user.userId, dto);
  }
}
