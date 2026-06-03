import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { InitQrPaymentDto } from './dto/init-qr-payment.dto';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get('my')
  @ApiOperation({ summary: 'Estado actual de la suscripción del vendedor' })
  getMySubscription(@CurrentUser() user: JwtUser) {
    return this.service.getMySubscription(user.userId);
  }

  @Post('qr/init')
  @ApiOperation({ summary: 'Iniciar pago con QR Baneco para un plan' })
  initQrPayment(@CurrentUser() user: JwtUser, @Body() dto: InitQrPaymentDto) {
    return this.service.initQrPayment(user.userId, dto.planId);
  }

  @Get('qr/status/:paymentId')
  @ApiOperation({ summary: 'Consultar estado del pago QR (polling)' })
  getQrStatus(@CurrentUser() user: JwtUser, @Param('paymentId') paymentId: string) {
    return this.service.getQrPaymentStatus(user.userId, paymentId);
  }
}
