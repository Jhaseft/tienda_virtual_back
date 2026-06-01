import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { StatsQueryDto } from './dto/stats-query.dto';
import { StatsService } from './stats.service';

@ApiTags('stats')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('admin')
  @ApiOperation({ summary: 'Obtener resumen de estadisticas por periodo' })
  getAdminStats(@CurrentUser() user: JwtUser, @Query() query: StatsQueryDto) {
    return this.statsService.getAdminStats(user.userId, query.period);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Datos del dashboard principal del vendedor' })
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.statsService.getDashboard(user.userId);
  }
}
