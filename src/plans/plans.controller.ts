import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // esta ruta es pública, no requiere autenticación, y devuelve solo los planes activos con sus precios en BOB y USD
  @Get()
  @ApiOperation({ summary: 'Listar planes activos con precio en BOB y USD' })
  getActivePlans() {
    return this.plansService.getActivePlans();
  }

  // esta ruta es solo para administradores, requiere autenticación, y devuelve todos los planes (activos e inactivos) con sus precios en BOB y USD
  @Get('admin')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar todos los planes (solo ADMIN)' })
  getAllPlans(@CurrentUser() user: JwtUser) {
    this.requireAdmin(user);
    return this.plansService.getAllPlans();
  }

  // esta ruta es solo para administradores, requiere autenticación, y permite crear un nuevo plan
  @Post('admin')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Crear un plan (solo ADMIN)' })
  createPlan(@CurrentUser() user: JwtUser, @Body() dto: CreatePlanDto) {
    this.requireAdmin(user);
    return this.plansService.createPlan(dto);
  }

  // esta ruta es solo para administradores, requiere autenticación, y permite actualizar un plan existente, solo actualiza los campos que se envían en el DTO
  @Patch('admin/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Editar un plan (solo ADMIN)' })
  updatePlan(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdatePlanDto) {
    this.requireAdmin(user);
    return this.plansService.updatePlan(id, dto);
  }

  //  esta ruta es solo para administradores, requiere autenticación, y permite desactivar un plan, lo que significa que ya no aparecerá en la lista de planes activos pero se mantendrá en la base de datos, si el plan no existe lanza una excepción de NotFound
  @Delete('admin/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Desactivar un plan (solo ADMIN)' })
  deactivatePlan(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    this.requireAdmin(user);
    return this.plansService.deactivatePlan(id);
  }

  // método privado para verificar que el usuario tenga rol de ADMIN, si no lanza una excepción de Forbidden
  private requireAdmin(user: JwtUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo los administradores pueden acceder a esta ruta');
    }
  }
}
