import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // API PARA GUARDAR EL TOKEN FCM DEL DISPOSITIVO/NAVEGADOR DEL USUARIO, ASOCIÁNDOLO A SU ID EN LA BASE DE DATOS
  @Post('token')
  @ApiOperation({ summary: 'Guardar token FCM del dispositivo/navegador del usuario' })
  saveToken(@CurrentUser() user: JwtUser, @Body() dto: { token: string }) {
    return this.notificationsService.saveToken(user.userId, dto.token);
  }

  // API PARA ELIMINAR UN TOKEN FCM (AL CERRAR SESIÓN EN ESE DISPOSITIVO/NAVEGADOR)
  @Delete('token')
  @ApiOperation({ summary: 'Eliminar token FCM (al cerrar sesión)' })
  deleteToken(@Body() dto: { token: string }) {
    return this.notificationsService.deleteToken(dto.token);
  }
}
