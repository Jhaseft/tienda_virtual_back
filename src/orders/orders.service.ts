import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { GetOrdersDto } from './dto/get-orders.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (order.clientId !== userId)
      throw new ForbiddenException('No autorizado');

    return order;
  }
}
