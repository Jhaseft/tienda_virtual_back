import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require('stripe');

@Injectable()
export class StripeService {
  private stripe: any;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!);
  }

  // metodo privado para obtener o crear el cliente de Stripe asociado al usuario, si el usuario ya tiene un stripeCustomerId intenta obtenerlo de Stripe para validar que exista, si no existe lo borra de la base de datos y crea uno nuevo, devuelve el id del cliente de Stripe válido asociado al usuario
  async getOrCreateCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, stripeCustomerId: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.stripeCustomerId) {
      try {
        const existing = await this.stripe.customers.retrieve(user.stripeCustomerId);
        if (!existing.deleted) return user.stripeCustomerId;
      } catch {
        await this.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: null } });
      }
    }

    const customer = await this.stripe.customers.create({
      email: user.email ?? undefined,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
      metadata: { userId },
    });

    await this.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  async createPaymentIntent(userId: string, planId: string) {
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

    const config = await this.systemConfig.getConfig();
    const exchangeRate = Number(config.exchangeRateBob) > 0 ? Number(config.exchangeRateBob) : 6.9;
    const priceUsd = Number(plan.price) / exchangeRate;

    const customerId = await this.getOrCreateCustomer(userId);

    // Solo crear el PaymentIntent en Stripe — sin tocar la BD hasta que el webhook confirme
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(priceUsd * 100),
      currency: 'usd',
      customer: customerId,
      payment_method_types: ['card'],
      metadata: { purpose: 'SUBSCRIPTION', storeId: store.id, planId },
    });

    this.logger.log(`PaymentIntent creado intentId=${paymentIntent.id} planId=${planId}`);
    return {
      paymentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      customerId,
      amount: priceUsd,
      currency: 'usd',
      planName: plan.name,
    };
  }

  // método para construir un evento de webhook de Stripe a partir del payload y la firma, si la firma no es válida lanza una excepción de BadRequest
  constructWebhookEvent(payload: Buffer, signature: string) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')!;
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      throw new BadRequestException('Webhook signature inválida');
    }
  }

  // método para manejar los eventos de pago exitoso y fallido de Stripe, si el evento es de tipo "payment_intent.succeeded" o "payment_intent.payment_failed" y el propósito es "SUBSCRIPTION", actualiza el estado del pago y la suscripción correspondiente
  async handlePaymentSuccess(paymentIntentId: string, metadata?: Record<string, string>) {
    if ((metadata?.purpose ?? '').toUpperCase() !== 'SUBSCRIPTION') return;

    const storeId = metadata?.storeId;
    const planId = metadata?.planId;
    if (!storeId || !planId) return;

    // Idempotencia: si ya fue procesado no hacer nada
    const existing = await this.prisma.subscriptionPayment.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (existing) return;

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { maxProducts: true, price: true },
    });

    await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.upsert({
        where: { storeId },
        update: { planId, status: 'ACTIVE', startDate: new Date(), endDate },
        create: {
          storeId,
          planId,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate,
        },
        select: { id: true },
      });

      await tx.subscriptionPayment.create({
        data: {
          subscriptionId: subscription.id,
          planId,
          amount: plan?.price ?? 0,
          paymentChannel: 'STRIPE',
          status: 'COMPLETED',
          stripePaymentIntentId: paymentIntentId,
        },
      });
    });

    await this.hideExcessProducts(storeId, plan?.maxProducts ?? -1);
    this.logger.log(`Suscripción activada vía Stripe storeId=${storeId} planId=${planId}`);
  }

  // método para manejar el evento de pago fallido de Stripe, si el evento es de tipo "payment_intent.payment_failed" y el propósito es "SUBSCRIPTION", actualiza el estado del pago a "FAILED"
  private async hideExcessProducts(storeId: string, maxProducts: number) {
    if (maxProducts === -1) return;

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

  async handlePaymentFailed(paymentIntentId: string, metadata?: Record<string, string>) {
    if ((metadata?.purpose ?? '').toUpperCase() !== 'SUBSCRIPTION') return;
    // No hay registro PENDING en BD — Stripe maneja el estado del intento fallido
    this.logger.warn(`Pago Stripe fallido intentId=${paymentIntentId}`);
  }
}
