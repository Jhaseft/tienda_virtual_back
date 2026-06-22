import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { GetOrdersDto } from './dto/get-orders.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PAID, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PAID, OrderStatus.CANCELLED],
  PAID: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) { }

  // ── Cliente: ver sus propios pedidos ─────────────────────────────────

  async getOrders(userId: string, dto: GetOrdersDto) {
    const { status, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const validStatuses = Object.values(OrderStatus);
    const where: { clientId: string; status?: OrderStatus } = {
      clientId: userId,
    };
    if (status && validStatuses.includes(status as OrderStatus)) {
      where.status = status as OrderStatus;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderSeq: true,
          status: true,
          paymentMethod: true,
          total: true,
          createdAt: true,
          store: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              storeType: true,
            },
          },
          items: {
            take: 3,
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              product: {
                select: {
                  name: true,
                  photos: {
                    take: 1,
                    orderBy: { order: 'asc' },
                    select: { url: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrderById(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderSeq: true,
        clientId: true,
        status: true,
        paymentMethod: true,
        deliveryAddress: true,
        subtotal: true,
        shippingCost: true,
        total: true,
        voucherUrl: true,
        whatsappThreadUrl: true,
        pickupMethod: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        address: {
          select: {
            fullName: true,
            street: true,
            city: true,
            state: true,
            phone: true,
          },
        },
        shippingZone: {
          select: {
            city: true,
            transportType: true,
            minHours: true,
            maxHours: true,
            shippingCost: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            storeType: true,
            whatsapp: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            size: true,
            colorName: true,
            product: {
              select: {
                id: true,
                name: true,
                photos: {
                  take: 1,
                  orderBy: { order: 'asc' },
                  select: { url: true },
                },
              },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.clientId !== userId) throw new ForbiddenException('No autorizado');

    return order;
  }

  // ── Admin: gestión de pedidos de la tienda ───────────────────────────

  async getAdminOrders(userId: string, query: OrderQueryDto) {
    const store = await this.getOwnedStore(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const trimmedSearch = query.search?.trim();

    const where: Prisma.OrderWhereInput = {
      storeId: store.id,
      ...(query.status ? { status: query.status } : {}),
      ...(trimmedSearch
        ? {
          OR: [
            { client: { firstName: { contains: trimmedSearch, mode: 'insensitive' } } },
            { client: { lastName: { contains: trimmedSearch, mode: 'insensitive' } } },
            { client: { phoneNumber: { contains: trimmedSearch, mode: 'insensitive' } } },
            ...(Number.isNaN(Number(trimmedSearch)) ? [] : [{ orderSeq: Number(trimmedSearch) }]),
          ],
        }
        : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              email: true,
              avatarUrl: true,
            },
          },
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: orders,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getAdminOrderById(userId: string, orderId: string) {
    const store = await this.getOwnedStore(userId);

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId: store.id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
            avatarUrl: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                photos: { take: 1, orderBy: { order: 'asc' }, select: { url: true } },
              },
            },
          },
        },
        address: {
          select: {
            fullName: true,
            street: true,
            city: true,
            state: true,
            phone: true,
          },
        },
        shippingZone: {
          select: {
            city: true,
            transportType: true,
            minHours: true,
            maxHours: true,
            shippingCost: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado');

    return order;
  }

  // METODO PARA ACTUALIZAR EL ESTADO DEL PEDIDO DESDE EL PANEL DE ADMINISTRACIÓN DE LA TIENDA
  async updateAdminOrderStatus(userId: string, orderId: string, nextStatus: OrderStatus) {
    const store = await this.getOwnedStore(userId);

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId: store.id },
      select: {
        id: true,
        status: true,
        orderSeq: true,
        total: true,
        paymentMethod: true,
        client: { select: { id: true, email: true, firstName: true, lastName: true } },
        store: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado');

    if (order.status === nextStatus) {
      return this.getAdminOrderById(userId, orderId);
    }

    const allowed = STATUS_TRANSITIONS[order.status];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`No se puede cambiar de ${order.status} a ${nextStatus}`);
    }

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: order.id },
        data: { status: nextStatus },
      }),
      ...(nextStatus === OrderStatus.DELIVERED
        ? [this.prisma.store.update({
          where: { id: store.id },
          data: { totalSales: { increment: 1 } },
        })]
        : []),
    ]);

    if (order.client.email) {
      this.mailService
        .sendOrderStatusToClient(
          order.client.email,
          {
            orderSeq: order.orderSeq,
            storeName: order.store.name,
            clientName: `${order.client.firstName ?? ''} ${order.client.lastName ?? ''}`.trim() || 'Cliente',
            total: order.total,
            paymentMethod: order.paymentMethod,
            items: order.items.map((i) => ({
              name: i.product.name,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          },
          nextStatus,
        )
        .catch(() => { });
    }

    const tokens = await this.notificationsService.getTokensByUser(order.client.id);
    this.notificationsService
      .sendMulticastNotification(
        tokens,
        'Pedido actualizado',
        `Tu pedido #${order.orderSeq}: ${nextStatus}`,
        { orderId: order.id, type: 'ORDER_STATUS' },
      )
      .catch((err) => console.error('Error push estado:', err));


    return this.getAdminOrderById(userId, orderId);
  }

  // METODO PRIVADO PARA OBTENER LA TIENDA ASOCIADA AL USUARIO (PARA VALIDAR QUE TIENE PERMISO DE ADMINISTRACION)
  private async getOwnedStore(userId: string) {
    const store = await this.prisma.store.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (!store) throw new NotFoundException('No tienes una tienda asociada para administrar');

    return store;
  }
}
