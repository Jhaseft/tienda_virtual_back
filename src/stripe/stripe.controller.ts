import { Body, Controller, Headers, Logger, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { StripeService } from './stripe.service';
import { IsUUID } from 'class-validator';

class InitStripePaymentDto {
  @IsUUID()
  planId!: string;
}

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);
  constructor(private readonly service: StripeService) {}

  // esta ruta inicia el proceso de pago con tarjeta para una suscripción a un plan, requiere autenticación, y devuelve el client secret del PaymentIntent creado en Stripe, si el usuario no tiene una tienda o el plan no existe lanza una excepción de NotFound
  @Post('subscription/init')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Iniciar pago con tarjeta Stripe para un plan' })
  createPaymentIntent(@CurrentUser() user: JwtUser, @Body() dto: InitStripePaymentDto) {
    return this.service.createPaymentIntent(user.userId, dto.planId);
  }

  // Stripe llama este endpoint al confirmar o rechazar un pago.
  // Sin JWT — la seguridad la da la firma del webhook (STRIPE_WEBHOOK_SECRET).
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook de Stripe — no llamar manualmente' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const event = this.service.constructWebhookEvent(req.rawBody!, signature);
    const obj = event.data.object as { id: string; metadata?: Record<string, string> };

    // Responder inmediatamente para evitar reintentos de Stripe
    const response = { received: true };

    switch (event.type) {
      case 'payment_intent.succeeded':
        this.service.handlePaymentSuccess(obj.id, obj.metadata).catch((e) =>
          this.logger.error(`handlePaymentSuccess failed: ${e?.message}`),
        );
        break;
      case 'payment_intent.payment_failed':
        this.service.handlePaymentFailed(obj.id, obj.metadata).catch(() => {});
        break;
    }

    return response;
  }
}
