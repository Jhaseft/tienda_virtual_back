import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { SetProductOptionsDto } from './dto/set-product-options.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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

  async createProduct(userId: string, dto: CreateProductDto) {
    const store = await this.getOwnedStore(userId);

    const product = await this.prisma.product.create({
      data: {
        storeId: store.id,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        stock: dto.stock,
        categoryId: dto.categoryId ?? null,
        isVisible: dto.isVisible ?? true,
        isAvailable: dto.isAvailable ?? true,
      },
      include: {
        photos: { select: { url: true }, orderBy: { order: 'asc' }, take: 1 },
        category: { select: { id: true, name: true } },
      },
    });

    return {
      ...product,
      imageUrl: product.photos[0]?.url ?? null,
      stockStatus: product.stock <= 0 ? 'OUT' : product.stock <= LOW_STOCK_THRESHOLD ? 'LOW' : 'OK',
    };
  }

  async deleteProduct(userId: string, productId: string) {
    const store = await this.getOwnedStore(userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    await this.prisma.$transaction([
      this.prisma.productSize.deleteMany({ where: { productId: product.id } }),
      this.prisma.productColor.deleteMany({ where: { productId: product.id } }),
      this.prisma.productPhoto.deleteMany({ where: { productId: product.id } }),
      this.prisma.favorite.deleteMany({ where: { productId: product.id } }),
      this.prisma.orderItem.deleteMany({ where: { productId: product.id } }),
      this.prisma.product.delete({ where: { id: product.id } }),
    ]);

    return { message: 'Producto eliminado correctamente' };
  }

  async updateProduct(userId: string, productId: string, dto: UpdateProductDto) {
    const store = await this.getOwnedStore(userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: {
        photos: { orderBy: { order: 'asc' } },
        sizes: { select: { id: true, size: true, stock: true } },
        colors: { select: { id: true, name: true, hexCode: true, stock: true } },
        category: { select: { id: true, name: true } },
        store: { select: { id: true, name: true, logoUrl: true, whatsapp: true, city: true } },
      },
    });

    return updated;
  }

  async getAdminProductById(userId: string, productId: string) {
    const store = await this.getOwnedStore(userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      include: {
        photos: { orderBy: { order: 'asc' } },
        sizes: { select: { id: true, size: true, stock: true } },
        colors: { select: { id: true, name: true, hexCode: true, stock: true } },
        category: { select: { id: true, name: true } },
        store: { select: { id: true, name: true, logoUrl: true, whatsapp: true, city: true } },
      },
    });

    if (!product) throw new NotFoundException('Producto no encontrado');

    return product;
  }

  async setProductOptions(userId: string, productId: string, dto: SetProductOptionsDto) {
    const store = await this.getOwnedStore(userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    await this.prisma.$transaction([
      ...(dto.sizes !== undefined
        ? [
            this.prisma.productSize.deleteMany({ where: { productId } }),
            ...dto.sizes.map((s) => this.prisma.productSize.create({ data: { productId, size: s.size, stock: 0 } })),
          ]
        : []),
      ...(dto.colors !== undefined
        ? [
            this.prisma.productColor.deleteMany({ where: { productId } }),
            ...dto.colors.map((c) =>
              this.prisma.productColor.create({
                data: { productId, name: c.name, hexCode: c.hexCode ?? null, stock: 0 },
              }),
            ),
          ]
        : []),
    ]);

    const updated = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        sizes: { select: { id: true, size: true } },
        colors: { select: { id: true, name: true, hexCode: true } },
      },
    });

    return updated;
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
