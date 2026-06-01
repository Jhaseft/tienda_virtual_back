import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PublicExplorarTiendaService {
  constructor(private readonly prisma: PrismaService) {}

  // VERIFICAR SI EL USUARIO SIGUE UNA TIENDA
  async isFollowing(storeId: string, userId: string): Promise<{ following: boolean }> {
    const record = await this.prisma.storeFollower.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });
    return { following: !!record };
  }

  // SEGUIR UNA TIENDA
  async followStore(storeId: string, userId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Tienda no encontrada');

    await this.prisma.storeFollower.upsert({
      where: { userId_storeId: { userId, storeId } },
      update: {},
      create: { userId, storeId },
    });

    return { message: 'Tienda seguida correctamente' };
  }

  // DEJAR DE SEGUIR UNA TIENDA
  async unfollowStore(storeId: string, userId: string) {
    await this.prisma.storeFollower.deleteMany({
      where: { storeId, userId },
    });

    return { message: 'Dejaste de seguir la tienda' };
  }

  // VERIFICAR SI UN PRODUCTO ESTÁ EN FAVORITOS
  async isFavorite(productId: string, userId: string): Promise<{ favorite: boolean }> {
    const record = await this.prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    return { favorite: !!record };
  }

  // AGREGAR PRODUCTO A FAVORITOS
  async addFavorite(productId: string, userId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    await this.prisma.favorite.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });

    return { message: 'Producto agregado a favoritos' };
  }

  // QUITAR PRODUCTO DE FAVORITOS
  async removeFavorite(productId: string, userId: string) {
    await this.prisma.favorite.deleteMany({
      where: { productId, userId },
    });

    return { message: 'Producto quitado de favoritos' };
  }
}
