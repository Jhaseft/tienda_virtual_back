import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateShippingZoneDto } from './dto/create-shipping-zone.dto';
import { UpdateShippingZoneDto } from './dto/update-shipping-zone.dto';

@Injectable()
export class ShippingZonesService {
  constructor(private readonly prisma: PrismaService) {}

  // METODO PARA OBTENER LA TIENDA ASOCIADA AL USUARIO, LANZA 404 SI NO EXISTE
  private async getStoreOrFail(userId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId: userId } });
    if (!store) throw new NotFoundException('No tienes una tienda asociada');
    return store;
  }

  // METODOS PARA MANEJAR ZONAS DE ENVÍO (CRUD)
  async getMyShippingZones(userId: string) {
    const store = await this.getStoreOrFail(userId);
    return this.prisma.shippingZone.findMany({
      where: { storeId: store.id },
      orderBy: [{ city: 'asc' }, { transportType: 'asc' }],
    });
  }

  // METODO PARA CREAR ZONA DE ENVIO, LANZA 400 SI YA EXISTE O SI MINHOURS >= MAXHOURS
  async createShippingZone(userId: string, dto: CreateShippingZoneDto) {
    if (dto.minHours >= dto.maxHours) {
      throw new BadRequestException('El mínimo de horas debe ser menor al máximo');
    }

    const store = await this.getStoreOrFail(userId);

    const existing = await this.prisma.shippingZone.findUnique({
      where: {
        storeId_city_transportType: {
          storeId: store.id,
          city: dto.city,
          transportType: dto.transportType,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(`Ya existe una zona para ${dto.city} con ese tipo de transporte`);
    }

    return this.prisma.shippingZone.create({
      data: {
        storeId: store.id,
        city: dto.city,
        transportType: dto.transportType,
        shippingCost: dto.shippingCost,
        minHours: dto.minHours,
        maxHours: dto.maxHours,
      },
    });
  }

  // METODO PARA ACTUALIZAR ZONA DE ENVIO, LANZA 404 SI NO EXISTE O SI MINHOURS >= MAXHOURS
  async updateShippingZone(userId: string, zoneId: string, dto: UpdateShippingZoneDto) {
    const store = await this.getStoreOrFail(userId);
    const zone = await this.prisma.shippingZone.findFirst({
      where: { id: zoneId, storeId: store.id },
    });
    if (!zone) throw new NotFoundException('Zona de envío no encontrada');

    const minHours = dto.minHours ?? zone.minHours;
    const maxHours = dto.maxHours ?? zone.maxHours;
    if (minHours >= maxHours) {
      throw new BadRequestException('El mínimo de horas debe ser menor al máximo');
    }

    return this.prisma.shippingZone.update({
      where: { id: zoneId },
      data: {
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.transportType !== undefined && { transportType: dto.transportType }),
        ...(dto.shippingCost !== undefined && { shippingCost: dto.shippingCost }),
        ...(dto.minHours !== undefined && { minHours: dto.minHours }),
        ...(dto.maxHours !== undefined && { maxHours: dto.maxHours }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // METODO PARA ELIMINAR ZONA DE ENVIO, LANZA 404 SI NO EXISTE
  async deleteShippingZone(userId: string, zoneId: string) {
    const store = await this.getStoreOrFail(userId);
    const zone = await this.prisma.shippingZone.findFirst({
      where: { id: zoneId, storeId: store.id },
    });
    if (!zone) throw new NotFoundException('Zona de envío no encontrada');
    await this.prisma.shippingZone.delete({ where: { id: zoneId } });
    return { message: 'Zona de envío eliminada correctamente' };
  }

  // Endpoint público — devuelve zonas activas agrupadas por ciudad
  async getPublicShippingZones(storeId: string) {
    const zones = await this.prisma.shippingZone.findMany({
      where: { storeId, isActive: true },
      orderBy: [{ city: 'asc' }, { shippingCost: 'asc' }],
      select: {
        id: true,
        city: true,
        transportType: true,
        shippingCost: true,
        minHours: true,
        maxHours: true,
      },
    });

    // Agrupar por ciudad
    const grouped = zones.reduce<Record<string, typeof zones>>((acc, zone) => {
      if (!acc[zone.city]) acc[zone.city] = [];
      acc[zone.city].push(zone);
      return acc;
    }, {});

    return Object.entries(grouped).map(([city, options]) => ({ city, options }));
  }
}
