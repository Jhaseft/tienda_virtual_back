import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('addresses')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  // API ENDPOINTS PARA MANEJAR LAS DIRECCIONES DE UN USUARIO, PROTEGIDOS POR JWT AUTH GUARD
  @Get()
  @ApiOperation({ summary: 'Listar mis direcciones' })
  getMyAddresses(@CurrentUser() user: JwtUser) {
    return this.addressesService.getMyAddresses(user.userId);
  }

  // API ENDPOINT PARA CREAR UNA NUEVA DIRECCIÓN, RECIBE LOS DATOS EN EL CUERPO DE LA PETICIÓN Y ASOCIA LA DIRECCIÓN AL USUARIO AUTENTICADO
  @Post()
  @ApiOperation({ summary: 'Crear nueva dirección' })
  createAddress(@CurrentUser() user: JwtUser, @Body() dto: CreateAddressDto) {
    return this.addressesService.createAddress(user.userId, dto);
  }

  // API ENDPOINT PARA ACTUALIZAR UNA DIRECCIÓN EXISTENTE, RECIBE LOS DATOS EN EL CUERPO DE LA PETICIÓN Y LA ASOCIA AL USUARIO AUTENTICADO
  @Patch(':id')
  @ApiOperation({ summary: 'Editar dirección' })
  updateAddress(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.addressesService.updateAddress(user.userId, id, dto);
  }

  // API ENDPOINT PARA MARCAR UNA DIRECCIÓN COMO PREDETERMINADA, ASOCIADA AL USUARIO AUTENTICADO
  @Patch(':id/default')
  @ApiOperation({ summary: 'Marcar dirección como predeterminada' })
  setDefault(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.addressesService.setDefault(user.userId, id);
  }

  // API ENDPOINT PARA ELIMINAR UNA DIRECCIÓN EXISTENTE, ASOCIADA AL USUARIO AUTENTICADO
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar dirección' })
  deleteAddress(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.addressesService.deleteAddress(user.userId, id);
  }
}
