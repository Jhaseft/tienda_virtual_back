import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  // método privado para agregar los precios en USD a los planes, usando el tipo genérico T para mantener la tipificación de los planes
  private async withPrices<T extends { price: number }>(plans: T[]) {
    const exchangeRate = await this.systemConfig.getExchangeRate();
    return plans.map((plan) => ({
      ...plan,
      priceBob: plan.price,
      priceUsd: Math.round((plan.price / exchangeRate) * 100) / 100,
    }));
  }

  // método para obtener solo los planes activos, ordenados por sortOrder ascendente
  async getActivePlans() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return this.withPrices(plans);
  }

  // método para obtener todos los planes, ordenados por sortOrder ascendente
  async getAllPlans() {
    const plans = await this.prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return this.withPrices(plans);
  }

  // método para crear un nuevo plan, los campos canAddPaymentMethods, hasAiAgent, hasAdvancedPayments y sortOrder son opcionales y tienen valores por defecto
  async createPlan(dto: CreatePlanDto) {
    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        price: dto.price,
        maxProducts: dto.maxProducts,
        description: dto.description,
        canAddPaymentMethods: dto.canAddPaymentMethods ?? false,
        hasAiAgent: dto.hasAiAgent ?? false,
        hasAdvancedPayments: dto.hasAdvancedPayments ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return (await this.withPrices([plan]))[0];
  }

  // método para actualizar un plan existente, solo actualiza los campos que se envían en el DTO, si el plan no existe lanza una excepción de NotFound
  async updatePlan(id: string, dto: UpdatePlanDto) {
    const exists = await this.prisma.plan.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Plan no encontrado');

    const plan = await this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.maxProducts !== undefined && { maxProducts: dto.maxProducts }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.canAddPaymentMethods !== undefined && { canAddPaymentMethods: dto.canAddPaymentMethods }),
        ...(dto.hasAiAgent !== undefined && { hasAiAgent: dto.hasAiAgent }),
        ...(dto.hasAdvancedPayments !== undefined && { hasAdvancedPayments: dto.hasAdvancedPayments }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
    return (await this.withPrices([plan]))[0];
  }

  // método para desactivar un plan, si el plan no existe lanza una excepción de NotFound
  async deactivatePlan(id: string) {
    const exists = await this.prisma.plan.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Plan no encontrado');

    await this.prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Plan desactivado correctamente' };
  }
}
