import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { BanecoApiService } from '../baneco-qr/baneco-api.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly banecoApi: BanecoApiService,
  ) { }

  private buildDueDate(): string {
    const due = new Date();
    due.setDate(due.getDate() + Number(this.banecoApi.qrTtlDays));
    return due.toISOString().slice(0, 10);
  }

  // método privado para obtener la tienda del usuario autenticado, si no tiene una tienda lanza una excepción de NotFound
  async initQrPayment(userId: string, planId: string) {
    const store = await this.prisma.store.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('No tienes una tienda asociada');

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId, isActive: true },
      select: { id: true, name: true, price: true },
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const existing = await this.prisma.subscriptionPayment.findFirst({
      where: {
        subscription: { storeId: store.id, planId },
        status: 'PENDING',
        paymentChannel: 'QR_BANCO',
        qrExpiresAt: { gt: new Date() },
      },
      select: { id: true, banecoQrId: true, qrExpiresAt: true },
    });
    if (existing?.banecoQrId) {
      // Regenerar el QR en Baneco para obtener la imagen actualizada
      try {
        const qr = await this.banecoApi.generateQR({
          transactionId: existing.id,
          amount: Number(plan.price),
          currency: 'BOB',
          description: `Tienda Virtual - ${plan.name}`,
          dueDate: this.buildDueDate(),
          singleUse: true,
          modifyAmount: false,
        });
        await this.prisma.subscriptionPayment.update({
          where: { id: existing.id },
          data: { banecoQrId: qr.qrId, qrExpiresAt: new Date(Date.now() + Number(this.banecoApi.qrTtlDays) * 86400000) },
        });
        return {
          paymentId: existing.id,
          qrId: qr.qrId,
          qrImage: qr.qrImage,
          amount: Number(plan.price),
          currency: 'BOB',
          dueDate: this.buildDueDate(),
        };
      } catch {
        // Si falla la regeneración, continuar y crear uno nuevo
      }
    }

    // Crear Subscription y SubscriptionPayment en transacción atómica
    const { subscription, payment } = await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.upsert({
        where: { storeId: store.id },
        update: {},
        create: {
          storeId: store.id,
          planId,
          status: 'PENDING',
          startDate: new Date(),
          endDate: new Date(),
        },
        select: { id: true },
      });

      // Verificar dentro de la transacción si ya existe un PENDING para este plan
      const alreadyPending = await tx.subscriptionPayment.findFirst({
        where: {
          subscriptionId: subscription.id,
          planId,
          paymentChannel: 'QR_BANCO',
          status: 'PENDING',
          qrExpiresAt: { gt: new Date() },
        },
        select: { id: true, banecoQrId: true, qrExpiresAt: true },
      });

      if (alreadyPending) return { subscription, payment: alreadyPending, existing: true };

      const payment = await tx.subscriptionPayment.create({
        data: {
          subscriptionId: subscription.id,
          planId,
          amount: plan.price,
          paymentChannel: 'QR_BANCO',
          status: 'PENDING',
        },
        select: { id: true },
      });

      return { subscription, payment, existing: false };
    });

    const qrExpiresAt = new Date();
    qrExpiresAt.setDate(qrExpiresAt.getDate() + this.banecoApi.qrTtlDays);

    try {
      const qr = await this.banecoApi.generateQR({
        transactionId: payment.id,
        amount: Number(plan.price),
        currency: 'BOB',
        description: `Tienda Virtual - ${plan.name}`,
        dueDate: this.buildDueDate(),
        singleUse: true,
        modifyAmount: false,
      });

      await this.prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { banecoQrId: qr.qrId, qrExpiresAt },
      });

      this.logger.log(`QR generado paymentId=${payment.id} qrId=${qr.qrId}`);
      return {
        paymentId: payment.id,
        qrId: qr.qrId,
        qrImage: qr.qrImage,
        amount: Number(plan.price),
        currency: 'BOB',
        dueDate: this.buildDueDate(),
      };
    } catch (err: any) {
      await this.prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      throw err;
    }
  }

  // método para aplicar un pago recibido del webhook de Baneco, busca el pago pendiente asociado al qrId, si lo encuentra lo marca como COMPLETED y activa la suscripción asociada por 30 días, si no encuentra el pago o ya fue procesado, solo registra un warning en el log
  async applyQrPayment(qrId: string) {
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: { banecoQrId: qrId, status: 'PENDING' },
      include: { subscription: { select: { id: true, planId: true, storeId: true } } },
    });
    if (!payment) return false;

    const claimed = await this.prisma.subscriptionPayment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'COMPLETED' },
    });
    if (claimed.count === 0) return true;

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    await this.prisma.subscription.update({
      where: { id: payment.subscription.id },
      data: { status: 'ACTIVE', startDate: new Date(), endDate },
    });

    this.logger.log(`Suscripción activada storeId=${payment.subscription.storeId} hasta ${endDate.toISOString().slice(0, 10)}`);
    return true;
  }

  // METODOS PARA OBTENER EL ESTADO DE LA SUSCRIPCIÓN Y PAGOS DEL USUARIO AUTENTICADO, SI EL USUARIO NO TIENE UNA TIENDA O SUSCRIPCIÓN LANZA UNA EXCEPCIÓN DE NOTFOUND
  async getMySubscription(userId: string) {
    const store = await this.prisma.store.findUnique({
      where: { ownerId: userId },
      select: { id: true, trialEndsAt: true },
    });
    if (!store) throw new NotFoundException('No tienes una tienda asociada');

    const [config, subscription, productsUsed] = await Promise.all([
      this.systemConfig.getConfig(),
      this.prisma.subscription.findUnique({
        where: { storeId: store.id },
        include: { plan: true },
      }),
      this.prisma.product.count({ where: { storeId: store.id } }),
    ]);

    const now = new Date();
    const exchangeRate = Number(config.exchangeRateBob) > 0 ? Number(config.exchangeRateBob) : 6.9;

    const daysLeft = (endDate: Date | null) =>
      endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000)) : 0;

    const planDetail = (plan: NonNullable<typeof subscription>['plan']) => ({
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      priceBob: Number(plan.price),
      priceUsd: Math.round((Number(plan.price) / exchangeRate) * 100) / 100,
    });

    if (subscription?.status === 'ACTIVE') {
      const plan = subscription.plan;
      return {
        status: 'ACTIVE',
        daysLeft: daysLeft(subscription.endDate),
        endDate: subscription.endDate,
        productsUsed,
        productsLimit: plan.maxProducts,
        canCreateProducts: plan.maxProducts === -1 || productsUsed < plan.maxProducts,
        canAddPaymentMethods: plan.canAddPaymentMethods,
        hasAiAgent: plan.hasAiAgent,
        hasAdvancedPayments: plan.hasAdvancedPayments,
        hasChat: plan.hasChat,
        plan: planDetail(plan),
      };
    }

    if (store.trialEndsAt && store.trialEndsAt > now) {
      return {
        status: 'TRIAL',
        daysLeft: daysLeft(store.trialEndsAt),
        trialEndsAt: store.trialEndsAt,
        productsUsed,
        productsLimit: config.trialMaxProducts,
        canCreateProducts: productsUsed < config.trialMaxProducts,
        canAddPaymentMethods: false,
        hasAiAgent: false,
        hasAdvancedPayments: false,
        hasChat: true,
        plan: null,
      };
    }

    return {
      status: subscription ? 'PENDING_PAYMENT' : 'TRIAL_EXPIRED',
      daysLeft: 0,
      trialEndsAt: store.trialEndsAt,
      productsUsed,
      productsLimit: config.trialMaxProducts,
      canCreateProducts: false,
      canAddPaymentMethods: false,
      hasAiAgent: false,
      hasAdvancedPayments: false,
      hasChat: false,
      plan: subscription ? planDetail(subscription.plan) : null,
    };
  }

  // método para obtener el estado de un pago específico del usuario autenticado, si no tiene una tienda o el pago no existe lanza una excepción de NotFound
  async getQrPaymentStatus(userId: string, paymentId: string) {
    const store = await this.prisma.store.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('No tienes una tienda asociada');

    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: { id: paymentId, subscription: { storeId: store.id } },
      select: { id: true, status: true, banecoQrId: true },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    return { paymentId: payment.id, status: payment.status };
  }
}
