import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ProductQueryDto } from './dto/product-query.dto';

const LOW_STOCK_THRESHOLD = 5;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminInventory(userId: string, query: ProductQueryDto) {
    const store = await this.getOwnedStore(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const trimmedSearch = query.search?.trim();

    const where: Prisma.ProductWhereInput = {
      storeId: store.id,
      ...(trimmedSearch
        ? {
            OR: [
              { name: { contains: trimmedSearch, mode: 'insensitive' } },
              { description: { contains: trimmedSearch, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          photos: {
            select: { url: true },
            orderBy: { order: 'asc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = products.map((product) => ({
      ...product,
      imageUrl: product.photos[0]?.url ?? null,
      stockStatus: product.stock <= 0 ? 'OUT' : product.stock <= LOW_STOCK_THRESHOLD ? 'LOW' : 'OK',
    }));

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    };
  }

  async updateProductStock(userId: string, productId: string, stock: number) {
    const store = await this.getOwnedStore(userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: { stock },
      include: {
        photos: {
          select: { url: true },
          orderBy: { order: 'asc' },
          take: 1,
        },
      },
    });

    return {
      ...updated,
      imageUrl: updated.photos[0]?.url ?? null,
      stockStatus: updated.stock <= 0 ? 'OUT' : updated.stock <= LOW_STOCK_THRESHOLD ? 'LOW' : 'OK',
    };
  }

  private async getOwnedStore(userId: string) {
    const store = await this.prisma.store.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (!store) {
      throw new NotFoundException('No tienes una tienda asociada para administrar');
    }

    return store;
  }
}
