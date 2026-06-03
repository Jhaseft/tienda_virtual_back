import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PaymentQR } from './baneco-api.service';

@Injectable()
export class BanecoQrService {
  private readonly logger = new Logger(BanecoQrService.name);

  constructor(private readonly prisma: PrismaService) {}

  // metodo para aplicar un pago recibido del webhook de Baneco, busca el pago pendiente asociado al qrId, si lo encuentra lo marca como COMPLETED y activa la suscripción asociada por 30 días, si no encuentra el pago o ya fue procesado, solo registra un warning en el log
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

    await this.prisma.subscription.update({
      where: { id: subPayment.subscriptionId },
      data: {
        status: 'ACTIVE',
        startDate: new Date(),
        endDate,
        // Asegura que el plan activado sea el del pago, no el último guardado
        ...(subPayment.planId ? { planId: subPayment.planId } : {}),
      },
    });

    this.logger.log(`[WEBHOOK] Suscripción activada subscriptionId=${subPayment.subscriptionId} hasta ${endDate.toISOString().slice(0, 10)}`);
  }
}
