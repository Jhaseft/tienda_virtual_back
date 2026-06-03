import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { SetProductOptionsDto } from './dto/set-product-options.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const LOW_STOCK_THRESHOLD = 5;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  // método para obtener el inventario de productos de la tienda del usuario autenticado, con paginación y búsqueda por nombre o descripción, solo devuelve los productos de la tienda del usuario, si el usuario no tiene una tienda lanza una excepción de NotFound
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

  // método para crear un nuevo producto en la tienda del usuario autenticado, verifica que el usuario tenga una tienda y que no haya alcanzado el límite de productos según su plan o periodo de prueba, si el usuario no tiene una tienda lanza una excepción de NotFound, si ha alcanzado el límite de productos lanza una excepción de Forbidden
  async createProduct(userId: string, dto: CreateProductDto) {
    const store = await this.getOwnedStore(userId);
    await this.checkProductLimit(store.id);

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

  // METODOS PRIVADOS PARA VALIDACIONES Y OBTENER LA TIENDA DEL USUARIO
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

  // MERODO PARA OBTENER UN PRODUCTO POR ID SOLO DE LA TIENDA DEL USUARIO AUTENTICADO, SI EL USUARIO NO TIENE UNA TIENDA O EL PRODUCTO NO PERTENECE A SU TIENDA LANZA UNA EXCEPCIÓN DE NOTFOUND
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

  // METODO PARA OBTENER O CREAR UN CUSTOMER EN STRIPE A PARTIR DEL USUARIO, SI EL USUARIO YA TIENE UN stripeCustomerId, verifica que el cliente exista en Stripe y no esté eliminado, si no existe o está eliminado borra el stripeCustomerId del usuario y crea uno nuevo, si el usuario no tiene un stripeCustomerId crea uno nuevo, devuelve el stripeCustomerId válido
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

  // METODO PARA ACTUALIZAR EL STOCK DE UN PRODUCTO, SOLO DE LA TIENDA DEL USUARIO AUTENTICADO, SI EL USUARIO NO TIENE UNA TIENDA O EL PRODUCTO NO PERTENECE A SU TIENDA LANZA UNA EXCEPCIÓN DE NOTFOUND
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

  // METODO PARA ELIMINAR UN PRODUCTO DE LA TIENDA DEL USUARIO AUTENTICADO, SI EL USUARIO NO TIENE UNA TIENDA O EL PRODUCTO NO PERTENECE A SU TIENDA LANZA UNA EXCEPCIÓN DE NOTFOUND, ELIMINA TAMBIÉN LAS TALLAS, COLORES, FOTOS, FAVORITOS Y ITEMS DE ORDEN ASOCIADOS AL PRODUCTO
  private async checkProductLimit(storeId: string) {
    const [productsUsed, subscription, store, config] = await Promise.all([
      this.prisma.product.count({ where: { storeId } }),
      this.prisma.subscription.findFirst({
        where: { storeId, status: 'ACTIVE' },
        include: { plan: { select: { maxProducts: true } } },
      }),
      this.prisma.store.findUnique({ where: { id: storeId }, select: { trialEndsAt: true } }),
      this.systemConfig.getConfig(),
    ]);

    if (subscription) {
      const limit = subscription.plan.maxProducts;
      if (limit !== -1 && productsUsed >= limit) {
        throw new ForbiddenException(`Límite de tu plan alcanzado (${limit} productos)`);
      }
      return;
    }

    const now = new Date();
    if (store?.trialEndsAt && store.trialEndsAt > now) {
      if (productsUsed >= config.trialMaxProducts) {
        throw new ForbiddenException(
          `Límite del periodo de prueba alcanzado (${config.trialMaxProducts} productos). Elige un plan para continuar.`,
        );
      }
      return;
    }

    throw new ForbiddenException('Tu periodo de prueba ha vencido. Elige un plan para continuar.');
  }

  // METODO PARA OBTENER LA TIENDA ASOCIADA AL USUARIO AUTENTICADO, SI NO TIENE UNA TIENDA LANZA UNA EXCEPCIÓN DE NOTFOUND, ESTE MÉTODO SE USA EN VARIOS LUGARES DEL SERVICIO PARA VALIDAR QUE EL USUARIO TIENE UNA TIENDA Y OBTENER SU ID
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
