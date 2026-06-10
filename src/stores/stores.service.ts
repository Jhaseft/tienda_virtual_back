import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { CreateSocialLinkDto } from './dto/create-social-link.dto';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { UpdateSocialLinkDto } from './dto/update-social-link.dto';
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

  // METODO PARA CREAR UNA NUEVA TIENDA, PRIMERO VERIFICA SI EL USUARIO YA TIENE UNA TIENDA ASOCIADA, SI ES ASI LANZA UNA EXCEPCION DE BAD REQUEST, SI NO CREA LA TIENDA CON LOS DATOS PROPORCIONADOS EN EL DTO Y ASIGNA UN PERIODO DE PRUEBA SEGUN LA CONFIGURACION DEL SISTEMA, FINALMENTE ACTUALIZA EL ROL DEL USUARIO A VENDOR Y DEVUELVE LA TIENDA CREADA
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

  // METODO PARA ACTUALIZAR UN SUBDOMINIO DE LA TIENDA, PRIMERO OBTIENE LA TIENDA DEL USUARIO, LUEGO VERIFICA QUE EL SUBDOMINIO NO ESTE EN LA LISTA DE RESERVADOS, SI ES ASI LANZA UNA EXCEPCION DE BAD REQUEST, LUEGO VERIFICA SI EL SUBDOMINIO YA ESTA EN USO POR OTRA TIENDA, SI ES ASI LANZA UNA EXCEPCION DE BAD REQUEST, SI PASA LAS VALIDACIONES ACTUALIZA EL SUBDOMINIO DE LA TIENDA Y DEVUELVE LA TIENDA ACTUALIZADA
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

  // METODO PARA ACTUALIZAR O CREAR UN METODO DE PAGO DE LA TIENDA, PRIMERO OBTIENE LA TIENDA DEL USUARIO, LUEGO VERIFICA SI EL DTO INCLUYE UN ID DE METODO DE PAGO, SI ES ASI INTENTA ENCONTRAR ESE METODO DE PAGO EN LA TIENDA, SI NO INCLUYE ID INTENTA ENCONTRAR UN METODO DE PAGO DEL MISMO TIPO EN LA TIENDA, SI ENCUENTRA UN METODO DE PAGO EXISTENTE LO ACTUALIZA CON LOS DATOS DEL DTO, SI NO ENCUENTRA UN METODO DE PAGO EXISTENTE CREA UNO NUEVO CON LOS DATOS DEL DTO, SI EL TIPO DE PAGO ES QR Y SE PROPORCIONA UNA URL O PUBLIC ID DE LA IMAGEN DEL QR ACTUALIZA ESOS CAMPOS EN LA TIENDA PARA FACILITAR SU USO POSTERIOR, FINALMENTE DEVUELVE EL METODO DE PAGO CREADO O ACTUALIZADO
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
            phoneNumber: dto.phoneNumber,
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
            phoneNumber: dto.phoneNumber,
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

  // METODO PARA ELIMINAR UN METODO DE PAGO DE LA TIENDA, PRIMERO OBTIENE LA TIENDA DEL USUARIO, LUEGO INTENTA ENCONTRAR EL METODO DE PAGO POR ID EN LA TIENDA, SI NO LO ENCUENTRA LANZA UNA EXCEPCION DE NOT FOUND, SI LO ENCUENTRA LO ELIMINA Y DEVUELVE UN MENSAJE DE EXITO
  private async getMyStoreOrFail(userId: string, storeId?: string) {
    const store = await this.prisma.store.findFirst({
      where: storeId ? { id: storeId, ownerId: userId } : { ownerId: userId },
      include: {
        paymentMethods: true,
        socialLinks: true,
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

  // METODO PARA ELIMINAR UN METODO DE PAGO DE LA TIENDA, PRIMERO OBTIENE LA TIENDA DEL USUARIO, LUEGO INTENTA ENCONTRAR EL METODO DE PAGO POR ID EN LA TIENDA, SI NO LO ENCUENTRA LANZA UNA EXCEPCION DE NOT FOUND, SI LO ENCUENTRA LO ELIMINA Y DEVUELVE UN MENSAJE DE EXITO
  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    const store = await this.getMyStoreOrFail(userId);
    const method = await this.prisma.storePaymentMethod.findFirst({
      where: { id: paymentMethodId, storeId: store.id },
    });
    if (!method) throw new NotFoundException('Método de pago no encontrado');
    await this.prisma.storePaymentMethod.delete({ where: { id: paymentMethodId } });
    return { message: 'Método de pago eliminado correctamente' };
  }

  // METODO PARA AGREGAR UN ENLACE DE RED SOCIAL A LA TIENDA, PRIMERO OBTIENE LA TIENDA DEL USUARIO, LUEGO CREA UN NUEVO REGISTRO DE ENLACE SOCIAL ASOCIADO A LA TIENDA CON LOS DATOS PROPORCIONADOS EN EL DTO Y DEVUELVE EL ENLACE CREADO
  async addSocialLink(userId: string, dto: CreateSocialLinkDto) {
    const store = await this.getMyStoreOrFail(userId);
    return this.prisma.storeSocialLink.create({
      data: { storeId: store.id, network: dto.network, url: dto.url },
    });
  }

  // METODO PARA ACTUALIZAR UN ENLACE DE RED SOCIAL DE LA TIENDA, PRIMERO OBTIENE LA TIENDA DEL USUARIO, LUEGO INTENTA ENCONTRAR EL ENLACE SOCIAL POR ID EN LA TIENDA, SI NO LO ENCUENTRA LANZA UNA EXCEPCION DE NOT FOUND, SI LO ENCUENTRA ACTUALIZA LOS CAMPOS PROPORCIONADOS EN EL DTO Y DEVUELVE EL ENLACE ACTUALIZADO
  async updateSocialLink(userId: string, linkId: string, dto: UpdateSocialLinkDto) {
    const store = await this.getMyStoreOrFail(userId);
    const link = await this.prisma.storeSocialLink.findFirst({
      where: { id: linkId, storeId: store.id },
    });
    if (!link) throw new NotFoundException('Red social no encontrada');
    return this.prisma.storeSocialLink.update({
      where: { id: linkId },
      data: {
        ...(dto.network !== undefined ? { network: dto.network } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
      },
    });
  }

  // METODO PARA ELIMINAR UN ENLACE DE RED SOCIAL DE LA TIENDA, PRIMERO OBTIENE LA TIENDA DEL USUARIO, LUEGO INTENTA ENCONTRAR EL ENLACE SOCIAL POR ID EN LA TIENDA, SI NO LO ENCUENTRA LANZA UNA EXCEPCION DE NOT FOUND, SI LO ENCUENTRA LO ELIMINA Y DEVUELVE UN MENSAJE DE EXITO
  async deleteSocialLink(userId: string, linkId: string) {
    const store = await this.getMyStoreOrFail(userId);
    const link = await this.prisma.storeSocialLink.findFirst({
      where: { id: linkId, storeId: store.id },
    });
    if (!link) throw new NotFoundException('Red social no encontrada');
    await this.prisma.storeSocialLink.delete({ where: { id: linkId } });
    return { message: 'Red social eliminada correctamente' };
  }
}
