import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminCustomers(userId: string, query: CustomerQueryDto) {
    const store = await this.getOwnedStore(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const trimmedSearch = query.search?.trim();

    const where: Prisma.OrderWhereInput = {
      storeId: store.id,
      ...(trimmedSearch
        ? {
            client: {
              OR: [
                {
                  firstName: { contains: trimmedSearch, mode: 'insensitive' },
                },
                {
                  lastName: { contains: trimmedSearch, mode: 'insensitive' },
                },
                {
                  phoneNumber: { contains: trimmedSearch, mode: 'insensitive' },
                },
              ],
            },
          }
        : {}),
    };

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        id: true,
        total: true,
        status: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summaryMap = new Map<
      string,
      {
        clientId: string;
        name: string;
        phoneNumber: string | null;
        email: string | null;
        totalOrders: number;
        totalSpent: number;
        lastOrderAt: Date | null;
      }
    >();

    for (const order of orders) {
      const client = order.client;
      const name = `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim() || 'Cliente';
      const existing = summaryMap.get(client.id);

      const canAddToTotal = order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.PENDING;

      if (!existing) {
        summaryMap.set(client.id, {
          clientId: client.id,
          name,
          phoneNumber: client.phoneNumber ?? null,
          email: client.email ?? null,
          totalOrders: 1,
          totalSpent: canAddToTotal ? order.total : 0,
          lastOrderAt: order.createdAt,
        });
        continue;
      }

      existing.totalOrders += 1;
      if (canAddToTotal) {
        existing.totalSpent += order.total;
      }
      if (!existing.lastOrderAt || existing.lastOrderAt < order.createdAt) {
        existing.lastOrderAt = order.createdAt;
      }
    }

    const customers = Array.from(summaryMap.values()).sort((a, b) => {
      if (b.totalOrders !== a.totalOrders) return b.totalOrders - a.totalOrders;
      return (b.lastOrderAt?.getTime() ?? 0) - (a.lastOrderAt?.getTime() ?? 0);
    });

    const paginated = customers.slice(skip, skip + limit);

    return {
      data: paginated,
      page,
      limit,
      total: customers.length,
      totalPages: Math.max(1, Math.ceil(customers.length / limit)),
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
