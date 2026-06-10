import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  // METODO PARA OBTENER LAS DIRECCIONES DE UN USUARIO, ORDENADAS POR DEFAULT Y FECHA DE CREACIÓN
  async getMyAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // METODO PARA CREAR UNA NUEVA DIRECCIÓN ASOCIADA A UN USUARIO, MANEJANDO LA DIRECCIÓN POR DEFECTO
  async createAddress(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const isFirst = (await this.prisma.address.count({ where: { userId } })) === 0;

    return this.prisma.address.create({
      data: {
        userId,
        fullName: dto.fullName,
        phone: dto.phone,
        street: dto.street,
        city: dto.city,
        state: dto.state,
        zipCode: dto.zipCode,
        country: dto.country ?? 'Bolivia',
        isDefault: dto.isDefault ?? isFirst,
      },
    });
  }

  // METODO PARA ACTUALIZAR UNA DIRECCIÓN EXISTENTE
  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address) throw new NotFoundException('Dirección no encontrada');
    if (address.userId !== userId) throw new ForbiddenException();

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, NOT: { id: addressId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data: {
        ...(dto.street !== undefined && { street: dto.street }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.zipCode !== undefined && { zipCode: dto.zipCode }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }

  // METODO PARA MARCAR UNA DIRECCIÓN COMO PREDETERMINADA, DESMARCANDO LA ANTERIOR
  async setDefault(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address) throw new NotFoundException('Dirección no encontrada');
    if (address.userId !== userId) throw new ForbiddenException();

    await this.prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    return this.prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  }

  // METODO PARA ELIMINAR UNA DIRECCIÓN, MANEJANDO LA ASIGNACIÓN DE NUEVA DIRECCIÓN POR DEFECTO SI ES NECESARIO
  async deleteAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address) throw new NotFoundException('Dirección no encontrada');
    if (address.userId !== userId) throw new ForbiddenException();

    await this.prisma.address.delete({ where: { id: addressId } });

    // Si era la default, marcar la más reciente como default
    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (next) {
        await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    return { message: 'Dirección eliminada correctamente' };
  }
}
