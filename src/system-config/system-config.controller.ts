import { Body, Controller, ForbiddenException, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { SystemConfigService } from './system-config.service';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@ApiTags('system-config')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('admin/config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  // solo los administradores pueden acceder a estas rutas, por eso se verifica el rol del usuario en cada método
  @Get()
  @ApiOperation({ summary: 'Obtener configuración del sistema (solo ADMIN)' })
  getConfig(@CurrentUser() user: JwtUser) {
    this.requireAdmin(user);
    return this.systemConfigService.getConfig();
  }

  // solo los administradores pueden actualizar la configuración del sistema, por eso se verifica el rol del usuario
  @Patch()
  @ApiOperation({ summary: 'Actualizar configuración del sistema (solo ADMIN)' })
  updateConfig(@CurrentUser() user: JwtUser, @Body() dto: UpdateSystemConfigDto) {
    this.requireAdmin(user);
    return this.systemConfigService.updateConfig(dto);
  }

  // método privado para verificar que el usuario tenga rol de ADMIN, si no lanza una excepción de Forbidden
  private requireAdmin(user: JwtUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo los administradores pueden acceder a esta ruta');
    }
  }
}
