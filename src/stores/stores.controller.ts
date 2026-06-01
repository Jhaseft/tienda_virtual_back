import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StoresService } from './stores.service';

@ApiTags('stores')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

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

  @Patch('me/payment-method')
  @ApiOperation({ summary: 'Actualizar o crear metodo de pago de mi tienda' })
  updateStorePaymentMethod(@CurrentUser() user: JwtUser, @Body() dto: UpdatePaymentMethodDto) {
    return this.storesService.updateStorePaymentMethod(user.userId, dto);
  }
}
