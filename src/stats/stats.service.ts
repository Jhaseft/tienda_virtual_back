import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { StatsPeriod } from './dto/stats-query.dto';

const VALID_SALES_STATUSES: OrderStatus[] = [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED];

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const store = await this.getOwnedStore(userId);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const LOW_STOCK_THRESHOLD = 5;

    const [
      todayOrders,
      totalProducts,
      totalOrders,
      lowStockCount,
      totalCustomers,
      storeOwner,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          storeId: store.id,
          status: { in: VALID_SALES_STATUSES },
          createdAt: { gte: todayStart },
        },
        select: { total: true },
      }),
      this.prisma.product.count({
        where: { storeId: store.id, isVisible: true, isAvailable: true },
      }),
      this.prisma.order.count({
        where: { storeId: store.id },
      }),
      this.prisma.product.count({
        where: { storeId: store.id, stock: { lte: LOW_STOCK_THRESHOLD }, isAvailable: true },
      }),
      this.prisma.order.groupBy({
        by: ['clientId'],
        where: { storeId: store.id },
      }).then((r) => r.length),
      this.prisma.store.findUnique({
        where: { id: store.id },
        select: { name: true, owner: { select: { firstName: true } } },
      }),
    ]);

    return {
      ownerName: storeOwner?.owner.firstName ?? null,
      storeName: storeOwner?.name ?? null,
      storeId: store.id,
      salesToday: {
        total: todayOrders.reduce((acc, o) => acc + o.total, 0),
        count: todayOrders.length,
      },
      totalProducts,
      totalOrders,
      lowStockCount,
      totalCustomers,
    };
  }

  async getAdminStats(userId: string, period: StatsPeriod) {
    const store = await this.getOwnedStore(userId);
    const now = new Date();
    const startDate = this.getPeriodStart(now, period);

    const orders = await this.prisma.order.findMany({
      where: {
        storeId: store.id,
        status: { in: VALID_SALES_STATUSES },
        createdAt: { gte: startDate, lte: now },
      },
      select: {
        id: true,
        clientId: true,
        total: true,
        createdAt: true,
      },
    });

    const orderIds = orders.map((order) => order.id);
    const currentClientIds = [...new Set(orders.map((order) => order.clientId))];
    const totalSales = orders.reduce((acc, order) => acc + order.total, 0);
    const totalOrders = orders.length;
    const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    let newClients = 0;
    if (currentClientIds.length > 0) {
      const previousOrders = await this.prisma.order.findMany({
        where: {
          storeId: store.id,
          status: { in: VALID_SALES_STATUSES },
          createdAt: { lt: startDate },
          clientId: { in: currentClientIds },
        },
        select: { clientId: true },
      });
      const previousClientSet = new Set(previousOrders.map((order) => order.clientId));
      newClients = currentClientIds.filter((clientId) => !previousClientSet.has(clientId)).length;
    }

    const groupedTopProducts =
      orderIds.length > 0
        ? await this.prisma.orderItem.groupBy({
            by: ['productId'],
            where: { orderId: { in: orderIds } },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5,
          })
        : [];

    const topProductIds = groupedTopProducts.map((item) => item.productId);
    const products =
      topProductIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: topProductIds } },
            select: { id: true, name: true },
          })
        : [];
    const productNameMap = new Map(products.map((product) => [product.id, product.name]));

    const topProducts = groupedTopProducts.map((item) => ({
      productId: item.productId,
      name: productNameMap.get(item.productId) ?? 'Producto',
      quantity: item._sum.quantity ?? 0,
    }));

    return {
      period,
      from: startDate,
      to: now,
      totalSales,
      totalOrders,
      newClients,
      averageTicket,
      topProducts,
    };
  }

  private getPeriodStart(now: Date, period: StatsPeriod) {
    const start = new Date(now);

    switch (period) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        return start;
      case 'week': {
        const day = start.getDay();
        const diff = (day + 6) % 7;
        start.setDate(start.getDate() - diff);
        start.setHours(0, 0, 0, 0);
        return start;
      }
      case 'year':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        return start;
      case 'month':
      default:
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        return start;
    }
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
