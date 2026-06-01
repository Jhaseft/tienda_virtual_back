import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { GetOrdersDto } from './dto/get-orders.dto';
import { OrderQueryDto } from './dto/order-query.dto';

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
  constructor(private readonly prisma: PrismaService) {}

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
        notes: true,
        createdAt: true,
        updatedAt: true,
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
          },
        },
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado');

    return order;
  }

  async updateAdminOrderStatus(userId: string, orderId: string, nextStatus: OrderStatus) {
    const store = await this.getOwnedStore(userId);

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId: store.id },
      select: { id: true, status: true },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado');

    if (order.status === nextStatus) {
      return this.getAdminOrderById(userId, orderId);
    }

    const allowed = STATUS_TRANSITIONS[order.status];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`No se puede cambiar de ${order.status} a ${nextStatus}`);
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: nextStatus },
    });

    return this.getAdminOrderById(userId, orderId);
  }

  private async getOwnedStore(userId: string) {
    const store = await this.prisma.store.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (!store) throw new NotFoundException('No tienes una tienda asociada para administrar');

    return store;
  }
}
