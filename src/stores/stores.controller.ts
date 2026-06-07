import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { CreateSocialLinkDto } from './dto/create-social-link.dto';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { UpdateSocialLinkDto } from './dto/update-social-link.dto';
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

  @Post('me/social-links')
  @ApiOperation({ summary: 'Agregar red social a mi tienda' })
  addSocialLink(@CurrentUser() user: JwtUser, @Body() dto: CreateSocialLinkDto) {
    return this.storesService.addSocialLink(user.userId, dto);
  }

  @Patch('me/social-links/:id')
  @ApiOperation({ summary: 'Editar red social de mi tienda' })
  updateSocialLink(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateSocialLinkDto) {
    return this.storesService.updateSocialLink(user.userId, id, dto);
  }

  @Delete('me/social-links/:id')
  @ApiOperation({ summary: 'Eliminar red social de mi tienda' })
  deleteSocialLink(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.storesService.deleteSocialLink(user.userId, id);
  }
}
