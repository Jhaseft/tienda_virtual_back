import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateSubdomainDto } from './dto/update-subdomain.dto';

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'dashboard',
  'app',
  'mail',
  'email',
  'ftp',
  'blog',
  'shop',
  'tienda',
  'tiendas',
  'static',
  'cdn',
  'assets',
  'media',
  'images',
  'help',
  'support',
  'docs',
  'status',
]);

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async createStore(userId: string, dto: CreateStoreDto) {
    const existing = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (existing) throw new BadRequestException('Ya tienes una tienda registrada');

    const trialDays = await this.systemConfig.getTrialDays();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const store = await this.prisma.store.create({
      data: {
        ownerId: userId,
        name: dto.name,
        whatsapp: dto.whatsapp,
        description: dto.description,
        address: dto.address,
        logoUrl: dto.logoUrl,
        logoPublicId: dto.logoPublicId,
        trialEndsAt,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'VENDOR' },
    });

    return store;
  }

  // método para obtener la configuración de la tienda del usuario autenticado, si el usuario no tiene una tienda lanza una excepción de NotFound
  async getStoreSettings(userId: string) {
    return this.getMyStoreOrFail(userId);
  }

  // método para actualizar la configuración de la tienda del usuario autenticado, solo actualiza los campos que se envían en el DTO, si el usuario no tiene una tienda lanza una excepción de NotFound
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

  async updateStoreSubdomain(userId: string, dto: UpdateSubdomainDto) {
    const store = await this.getMyStoreOrFail(userId);
    const subdomain = dto.subdomain.trim().toLowerCase();

    if (RESERVED_SUBDOMAINS.has(subdomain)) {
      throw new BadRequestException('Ese subdominio está reservado, elige otro.');
    }

    const taken = await this.prisma.store.findUnique({ where: { subdomain } });
    if (taken && taken.id !== store.id) {
      throw new BadRequestException('Ese subdominio ya está en uso por otra tienda.');
    }

    const updated = await this.prisma.store.update({
      where: { id: store.id },
      data: { subdomain },
      select: { id: true, subdomain: true },
    });

    return updated;
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
