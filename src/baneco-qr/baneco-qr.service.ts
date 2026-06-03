import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PaymentQR } from './baneco-api.service';

@Injectable()
export class BanecoQrService {
  private readonly logger = new Logger(BanecoQrService.name);

  constructor(private readonly prisma: PrismaService) {}

  // metodo para aplicar un pago recibido del webhook de Baneco, busca el pago pendiente asociado al qrId, si lo encuentra lo marca como COMPLETED y activa la suscripción asociada por 30 días, si no encuentra el pago o ya fue procesado, solo registra un warning en el log
  private async hideExcessProducts(storeId: string, maxProducts: number) {
    if (maxProducts === -1) return; // ilimitado

    const products = await this.prisma.product.findMany({
      where: { storeId, isVisible: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (products.length <= maxProducts) return;

    const toHide = products.slice(maxProducts).map((p) => p.id);
    await this.prisma.product.updateMany({
      where: { id: { in: toHide } },
      data: { isVisible: false },
    });

    this.logger.log(`[PLAN] ${toHide.length} productos ocultados en storeId=${storeId} (límite=${maxProducts})`);
  }

  async applyPayment(payment: PaymentQR) {
    const subPayment = await this.prisma.subscriptionPayment.findFirst({
      where: { banecoQrId: payment.qrId, status: 'PENDING' },
      select: { id: true, subscriptionId: true, planId: true },
    });

    if (!subPayment) {
      this.logger.warn(`[WEBHOOK] qrId=${payment.qrId} sin SubscriptionPayment asociado`);
      return;
    }

    // Atomic claim: solo el primer llamado concurrente aplica el pago
    const claimed = await this.prisma.subscriptionPayment.updateMany({
      where: { id: subPayment.id, status: 'PENDING' },
      data: { status: 'COMPLETED' },
    });

    if (claimed.count === 0) {
      this.logger.warn(`[WEBHOOK] qrId=${payment.qrId} ya procesado`);
      return;
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const subscription = await this.prisma.subscription.update({
      where: { id: subPayment.subscriptionId },
      data: {
        status: 'ACTIVE',
        startDate: new Date(),
        endDate,
        ...(subPayment.planId ? { planId: subPayment.planId } : {}),
      },
      include: { plan: true, store: { select: { id: true } } },
    });

    await this.hideExcessProducts(subscription.store.id, subscription.plan.maxProducts);

    this.logger.log(`[WEBHOOK] Suscripción activada subscriptionId=${subPayment.subscriptionId} hasta ${endDate.toISOString().slice(0, 10)}`);
  }
}
