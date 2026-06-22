import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) { }

  // METODO PARA CREAR UN PEDIDO, CON VALIDACIONES DE TIENDA, DIRECCIÓN, ZONA DE ENVÍO, PRODUCTOS Y STOCK, TODO EN UNA TRANSACCIÓN
  async createPedido(userId: string, dto: CreatePedidoDto) {
    // 1. Validar que la tienda existe
    const store = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
      select: {
        id: true,
        name: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!store) throw new NotFoundException('Tienda no encontrada');

    // 2. Validar que la dirección pertenece al usuario
    const [address, client] = await Promise.all([
      this.prisma.address.findUnique({ where: { id: dto.addressId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      }),
    ]);
    if (!address || address.userId !== userId) {
      throw new NotFoundException('Dirección no encontrada');
    }

    // 3. Obtener costo de envío si eligió zona
    let shippingCost = 0;
    if (dto.shippingZoneId) {
      const zone = await this.prisma.shippingZone.findUnique({
        where: { id: dto.shippingZoneId },
        select: { shippingCost: true, isActive: true },
      });
      if (!zone || !zone.isActive) throw new NotFoundException('Zona de envío no disponible');
      shippingCost = zone.shippingCost;
    }

    // 4. Validar productos y stock
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, storeId: dto.storeId, isAvailable: true },
      select: { id: true, name: true, price: true, stock: true },
    });

    if (products.length !== dto.items.length) {
      throw new NotFoundException('Uno o más productos no están disponibles en esta tienda');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;
      if (product.stock < item.quantity) {
        throw new BadRequestException(`Stock insuficiente para "${product.name}" (disponible: ${product.stock})`);
      }
    }

    // 5. Calcular subtotal
    const subtotal = dto.items.reduce((sum, item) => {
      const product = productMap.get(item.productId)!;
      return sum + product.price * item.quantity;
    }, 0);

    const total = subtotal + shippingCost;

    // 6. Crear la Order + OrderItems + descontar stock en una transacción
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          clientId: userId,
          storeId: dto.storeId,
          addressId: dto.addressId,
          shippingZoneId: dto.shippingZoneId,
          pickupMethod: dto.pickupMethod,
          paymentMethod: dto.paymentMethod,
          subtotal,
          shippingCost,
          total,
          notes: dto.note,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: productMap.get(item.productId)!.price,
              size: item.variant,
              colorName: item.colorName,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
          address: true,
          shippingZone: { select: { city: true, transportType: true, minHours: true, maxHours: true } },
        },
      });

      // Descontar stock
      for (const item of dto.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Limpiar CartItems de esta tienda para este usuario
      await tx.cartItem.deleteMany({
        where: { userId, storeId: dto.storeId },
      });

      return created;
    });

    if (store.owner.email) {
      this.mailService
        .sendNewOrderToSeller(store.owner.email, {
          orderSeq: order.orderSeq,
          storeName: store.name,
          clientName: `${client?.firstName ?? ''} ${client?.lastName ?? ''}`.trim() || 'Cliente',
          total: order.total,
          paymentMethod: dto.paymentMethod,
          items: order.items.map((i) => ({
            name: i.product.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        })
        .catch((err) => console.error('Error enviando correo de nuevo pedido:', err));
    }

    const tokens = await this.notificationsService.getTokensByUser(store.owner.id);
    this.notificationsService
      .sendMulticastNotification(
        tokens,
        'Nuevo pedido',
        `Pedido #${order.orderSeq} - Bs ${order.total}`,
        { orderId: order.id, type: 'NEW_ORDER' },
      )
      .catch((err) => console.error('Error push nuevo pedido:', err));

    return order;
  }
}
