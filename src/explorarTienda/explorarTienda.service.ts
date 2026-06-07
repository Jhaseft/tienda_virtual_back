import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SearchExplorerDto } from './dto/search-explorer.dto';
import { GetStoreProductsDto } from './dto/get-store-products.dto';

@Injectable()
export class ExplorarTiendaService {
  constructor(private readonly prisma: PrismaService) {}

  //OBTENER CATEGORÍAS ORDENADAS ALFABÉTICAMENTE
  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        iconUrl: true,
      },
    });
  }

  // OBTENER TIENDAS RECOMENDADAS ORDENADAS POR RATING
  async getRecommendedStores() {
    return this.prisma.store.findMany({
      where: {
        isOpen: true,
        subscription: { status: 'ACTIVE' },
      },
      orderBy: { rating: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        storeType: true,
        logoUrl: true,
        city: true,
        rating: true,
        totalSales: true,
        totalReviews: true,
      },
    });
  }

  // BUSCAR PRODUCTOS Y TIENDAS POR TÉRMINO DE BÚSQUEDA CON PAGINACIÓN
  async search(dto: SearchExplorerDto) {
    const { q, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    if (!q || q.trim() === '') {
      return { stores: [], products: [], productTotal: 0, productTotalPages: 0 };
    }

    const term = q.trim();
    const productWhere = {
      isVisible: true,
      isAvailable: true,
      OR: [
        { name: { contains: term, mode: 'insensitive' as const } },
        { description: { contains: term, mode: 'insensitive' as const } },
      ],
    };

    const [stores, products, productTotal] = await Promise.all([
      this.prisma.store.findMany({
        where: {
          isOpen: true,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { storeType: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: {
          id: true,
          name: true,
          storeType: true,
          logoUrl: true,
          city: true,
          rating: true,
        },
      }),
      this.prisma.product.findMany({
        where: productWhere,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          photos: {
            take: 1,
            orderBy: { order: 'asc' },
            select: { url: true },
          },
          store: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where: productWhere }),
    ]);

    return {
      stores,
      products,
      productTotal,
      productTotalPages: Math.ceil(productTotal / limit),
      page,
      limit,
    };
  }

  // OBTENER DETALLE COMPLETO DE UN PRODUCTO
  async getProductById(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId, isVisible: true, isAvailable: true },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        isAvailable: true,
        photos: {
          orderBy: { order: 'asc' },
          select: { url: true, order: true },
        },
        sizes: {
          select: { id: true, size: true, stock: true },
          orderBy: { size: 'asc' },
        },
        colors: {
          select: { id: true, name: true, hexCode: true, stock: true },
        },
        category: {
          select: { id: true, name: true },
        },
        store: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            whatsapp: true,
            city: true,
            rating: true,
          },
        },
      },
    });

    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  // OBTENER TIENDAS QUE TIENEN PRODUCTOS EN UNA CATEGORÍA
  async getStoresByCategory(categoryId: string) {
    return this.prisma.store.findMany({
      where: {
        isOpen: true,
        subscription: { status: 'ACTIVE' },
        products: {
          some: {
            categoryId,
            isVisible: true,
            isAvailable: true,
          },
        },
      },
      orderBy: { rating: 'desc' },
      select: {
        id: true,
        name: true,
        storeType: true,
        logoUrl: true,
        city: true,
        rating: true,
        totalReviews: true,
        totalSales: true,
      },
    });
  }

  // OBTENER DETALLE COMPLETO DE UNA TIENDA
  // RESOLVER SUBDOMINIO -> ID DE TIENDA (lookup público para multi-tenancy)
  async getStoreIdBySubdomain(subdomain: string) {
    const clean = subdomain.trim().toLowerCase();
    const store = await this.prisma.store.findUnique({
      where: { subdomain: clean },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('Tienda no encontrada');
    return store;
  }

  async getStoreById(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        storeType: true,
        description: true,
        logoUrl: true,
        address: true,
        city: true,
        whatsapp: true,
        isOpen: true,
        rating: true,
        totalReviews: true,
        totalSales: true,
        _count: {
          select: { followers: true, products: true },
        },
        socialLinks: {
          select: { id: true, network: true, url: true },
        },
      },
    });

    if (!store) throw new NotFoundException('Tienda no encontrada');
    return store;
  }

  // OBTENER PRODUCTOS DE UNA TIENDA CON PAGINACIÓN
  async getStoreProducts(storeId: string, dto: GetStoreProductsDto) {
    const { q, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: any = { storeId, isVisible: true, isAvailable: true };
    if (q?.trim()) {
      where.name = { contains: q.trim(), mode: 'insensitive' };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          stock: true,
          photos: {
            take: 1,
            orderBy: { order: 'asc' },
            select: { url: true },
          },
          category: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // OBTENER MÉTODOS DE PAGO DE UNA TIENDA
  async getStorePaymentMethods(storeId: string) {
    return this.prisma.storePaymentMethod.findMany({
      where: { storeId },
      select: {
        id: true,
        type: true,
        bankName: true,
        accountHolder: true,
        accountNumber: true,
        qrImageUrl: true,
      },
    });
  }

  // OBTENER DATOS PARA LA PÁGINA DE INICIO: CATEGORÍAS Y TIENDAS RECOMENDADAS
  async getHomeData() {
    const [categories, recommendedStores] = await Promise.all([this.getCategories(), this.getRecommendedStores()]);

    return { categories, recommendedStores };
  }
}
