import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { OrderStatus } from '@prisma/client';

const STATUS_CONFIG: Record<OrderStatus, { label: string; emoji: string }> = {
  PENDING: { label: 'Pedido recibido, esperando confirmación', emoji: '⏳' },
  CONFIRMED: { label: 'Tu pedido fue confirmado', emoji: '✅' },
  PAID: { label: 'Pago verificado', emoji: '💳' },
  SHIPPED: { label: 'Tu pedido está en camino', emoji: '🚚' },
  DELIVERED: { label: 'Tu pedido fue entregado', emoji: '🎉' },
  CANCELLED: { label: 'Tu pedido fue cancelado', emoji: '❌' },
};

interface OrderMailData {
  orderSeq: number;
  storeName: string;
  clientName: string;
  total: number;
  paymentMethod: string;
  items: { name: string; quantity: number; unitPrice: number }[];
}

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) { }

  // METODO PARA ENVIAR CODIGO DE VERIFICACION DE 6 DIGITOS AL CORREO DEL USUARIO (USADO EN RECUPERACION DE CONTRASEÑA)
  async send6DigitCode(email: string, code: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Código de verificación - MiTienda',
      template: 'verification-code',
      context: { code, year: new Date().getFullYear() },
    });
  }

  // METODO PARA ENVIAR NOTIFICACION DE NUEVO PEDIDO AL VENDEDOR
  async sendNewOrderToSeller(sellerEmail: string, data: OrderMailData) {
    await this.mailerService.sendMail({
      to: sellerEmail,
      subject: `Nuevo pedido #${data.orderSeq} - ${data.storeName}`,
      template: 'new-order',
      text: `Tienes un nuevo pedido #${data.orderSeq} en ${data.storeName}. Cliente: ${data.clientName}. Total: Bs ${data.total}. Pago: ${data.paymentMethod}.`,
      context: { ...data, date: new Date().toLocaleDateString('es-ES'), year: new Date().getFullYear() },
    });
  }

  // METODO PARA ENVIAR ACTUALIZACION DE ESTADO DE PEDIDO AL CLIENTE
  async sendOrderStatusToClient(clientEmail: string, data: OrderMailData, status: OrderStatus) {
    const { label, emoji } = STATUS_CONFIG[status] ?? { label: status, emoji: '📦' };
    await this.mailerService.sendMail({
      to: clientEmail,
      subject: `Actualización de tu pedido #${data.orderSeq} - ${data.storeName}`,
      template: 'order-status',
      text: `Hola ${data.clientName}, tu pedido #${data.orderSeq} en ${data.storeName} cambió de estado: ${label}.`,
      context: { ...data, statusLabel: label, statusEmoji: emoji, date: new Date().toLocaleDateString('es-ES'), year: new Date().getFullYear() },
    });
  }
}
