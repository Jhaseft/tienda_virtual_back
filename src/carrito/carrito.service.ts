import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CarritoService {
  constructor(private readonly prisma: PrismaService) {}

  // OBTENER CARRITO AGRUPADO POR TIENDA
  async getMyCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        quantity: true,
        variant: true,
        colorName: true,
        store: { select: { id: true, name: true, logoUrl: true } },
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            photos: { take: 1, orderBy: { order: 'asc' }, select: { url: true } },
          },
        },
      },
    });

    // Agrupar por tienda
    const grouped = new Map<string, { store: (typeof items)[number]['store']; items: typeof items }>();
    for (const item of items) {
      const storeId = item.store.id;
      if (!grouped.has(storeId)) {
        grouped.set(storeId, { store: item.store, items: [] });
      }
      grouped.get(storeId)!.items.push(item);
    }

    return Array.from(grouped.values()).map((group) => ({
      store: group.store,
      items: group.items,
      subtotal: group.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    }));
  }

  // AGREGAR PRODUCTO AL CARRITO, SI YA EXISTE SUMA LA CANTIDAD
  async addToCart(userId: string, dto: AddToCartDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId, storeId: dto.storeId, isAvailable: true },
      select: { id: true, stock: true, name: true },
    });
    if (!product) throw new NotFoundException('Producto no disponible');

    const existing = await this.prisma.cartItem.findFirst({
      where: {
        userId,
        productId: dto.productId,
        storeId: dto.storeId,
        variant: dto.variant ?? null,
        colorName: dto.colorName ?? null,
      },
    });

    if (existing) {
      const newQty = existing.quantity + dto.quantity;
      if (newQty > product.stock) {
        throw new BadRequestException(`Stock insuficiente (disponible: ${product.stock})`);
      }
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
    }

    if (dto.quantity > product.stock) {
      throw new BadRequestException(`Stock insuficiente (disponible: ${product.stock})`);
    }

    return this.prisma.cartItem.create({
      data: {
        userId,
        storeId: dto.storeId,
        productId: dto.productId,
        quantity: dto.quantity,
        variant: dto.variant,
        colorName: dto.colorName,
      },
    });
  }

  // ACTUALIZAR CANTIDAD DE UN ITEM
  async updateCartItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: { select: { stock: true, name: true } } },
    });
    if (!item || item.userId !== userId) throw new NotFoundException('Item no encontrado');
    if (dto.quantity > item.product.stock) {
      throw new BadRequestException(`Stock insuficiente (disponible: ${item.product.stock})`);
    }
    return this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity: dto.quantity } });
  }

  // ELIMINAR UN ITEM DEL CARRITO
  async removeCartItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.userId !== userId) throw new NotFoundException('Item no encontrado');
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return { message: 'Producto eliminado del carrito' };
  }

  // VACIAR TODOS LOS ITEMS DE UNA TIENDA EN EL CARRITO
  async clearStoreCart(userId: string, storeId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId, storeId } });
    return { message: 'Carrito de la tienda vaciado' };
  }
}
