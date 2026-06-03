import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BanecoQrService } from './baneco-qr.service';

@ApiTags('Baneco QR')
@Controller('baneco-qr')
export class BanecoQrController {
  private readonly logger = new Logger(BanecoQrController.name);

  constructor(private readonly service: BanecoQrService) {}

  // Webhook público llamado por el banco al confirmar un pago.
  // Sin JWT — la seguridad la da que el qrId solo lo conoce el banco.
  @Post('notify')
  @ApiOperation({ summary: 'Webhook de notificación de pago QR (Baneco)' })
  async notify(@Body() body: { Payment?: any; payment?: any }) {
    const payment = body?.Payment ?? body?.payment;
    if (payment?.qrId) {
      await this.service.applyPayment(payment);
    }
    return { responseCode: 0, message: '' };
  }
}
