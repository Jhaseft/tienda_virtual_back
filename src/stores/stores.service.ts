import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async createStore(userId: string, dto: CreateStoreDto) {
    const existing = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (existing) throw new BadRequestException('Ya tienes una tienda registrada');

    const store = await this.prisma.store.create({
      data: {
        ownerId: userId,
        name: dto.name,
        whatsapp: dto.whatsapp,
        description: dto.description,
        address: dto.address,
        logoUrl: dto.logoUrl,
        logoPublicId: dto.logoPublicId,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'VENDOR' },
    });

    return store;
  }

  async getStoreSettings(userId: string) {
    return this.getMyStoreOrFail(userId);
  }

  async updateStoreSettings(userId: string, dto: UpdateStoreDto) {
    const store = await this.getMyStoreOrFail(userId);

    if (dto.notificationsEnabled !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { notificationsEnabled: dto.notificationsEnabled },
      });
    }

    const updatedStore = await this.prisma.store.update({
      where: { id: store.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.whatsapp !== undefined ? { whatsapp: dto.whatsapp } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.logoPublicId !== undefined ? { logoPublicId: dto.logoPublicId } : {}),
      },
    });

    return this.getMyStoreOrFail(userId, updatedStore.id);
  }

  async updateStorePaymentMethod(userId: string, dto: UpdatePaymentMethodDto) {
    const store = await this.getMyStoreOrFail(userId);

    const targetPaymentMethod = dto.id
      ? await this.prisma.storePaymentMethod.findFirst({
          where: { id: dto.id, storeId: store.id },
        })
      : await this.prisma.storePaymentMethod.findFirst({
          where: { storeId: store.id, type: dto.type },
        });

    const paymentMethod = targetPaymentMethod
      ? await this.prisma.storePaymentMethod.update({
          where: { id: targetPaymentMethod.id },
          data: {
            type: dto.type,
            bankName: dto.bankName,
            accountHolder: dto.accountHolder,
            accountNumber: dto.accountNumber,
            qrImageUrl: dto.qrImageUrl,
            qrImagePublicId: dto.qrImagePublicId,
          },
        })
      : await this.prisma.storePaymentMethod.create({
          data: {
            storeId: store.id,
            type: dto.type,
            bankName: dto.bankName,
            accountHolder: dto.accountHolder,
            accountNumber: dto.accountNumber,
            qrImageUrl: dto.qrImageUrl,
            qrImagePublicId: dto.qrImagePublicId,
          },
        });

    if (dto.type === 'QR' && (dto.qrImageUrl || dto.qrImagePublicId)) {
      await this.prisma.store.update({
        where: { id: store.id },
        data: {
          ...(dto.qrImageUrl !== undefined ? { qrImageUrl: dto.qrImageUrl } : {}),
          ...(dto.qrImagePublicId !== undefined ? { qrImagePublicId: dto.qrImagePublicId } : {}),
        },
      });
    }

    return paymentMethod;
  }

  private async getMyStoreOrFail(userId: string, storeId?: string) {
    const store = await this.prisma.store.findFirst({
      where: storeId ? { id: storeId, ownerId: userId } : { ownerId: userId },
      include: {
        paymentMethods: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            notificationsEnabled: true,
          },
        },
      },
    });

    if (!store) {
      throw new NotFoundException('No tienes una tienda asociada para administrar');
    }

    return store;
  }
}
