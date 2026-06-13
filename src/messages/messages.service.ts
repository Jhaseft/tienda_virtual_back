import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MessageRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
  ) {}

  async uploadMultimedia(file: Express.Multer.File | undefined): Promise<{ multimediaUrl: string; multimediaPublicId: string }> {
    const result = await this.uploadsService.uploadFile(file, 'chat');
    return { multimediaUrl: result.url, multimediaPublicId: result.publicId };
  }

  // METODO PARA CALCULAR EL CORTE DE TIEMPO DE LOS MENSAJES SEGUN LA CONFIGURACION (72 HORAS POR DEFECTO)
  private ttlCutoff(): Date {
    const hours = Number(process.env.MESSAGE_TTL_HOURS ?? 72);
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }

  // CRON QUE SE EJECUTA CADA HORA PARA ELIMINAR LOS MENSAJES QUE SUPEREN EL TIEMPO DE VIDA CONFIGURADO
  @Cron(CronExpression.EVERY_HOUR)
  async deleteExpiredMessages() {
    const cutoff = this.ttlCutoff();
    const result = await this.prisma.message.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      this.logger.log(`Eliminados ${result.count} mensajes expirados`);
    }
  }

  // METODO PARA INICIAR O CONTINUAR UNA CONVERSACION
  // clientId: quien compra (si el vendor inicia, debe pasar el clientId del destinatario)
  async createMessage(
    senderId: string,
    storeId: string,
    text: string | undefined,
    senderRole: MessageRole,
    clientId?: string,
    multimediaUrl?: string,
    multimediaPublicId?: string,
  ) {
    const messageText = text?.trim() || undefined;
    if (!messageText && !multimediaUrl) {
      throw new BadRequestException('El mensaje debe tener texto o multimedia.');
    }

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, ownerId: true },
    });
    if (!store) {
      throw new BadRequestException('La tienda no existe.');
    }
    if (store.ownerId === senderId) {
      throw new BadRequestException('No puedes escribirte a tu propia tienda.');
    }

    // El clientId es quien compra: el sender si es CLIENT,
    // si es VENDOR escribiendo a otra tienda (como comprador) también se usa senderId,
    // solo se requiere clientId cuando el vendor inicia desde el panel de admin
    const resolvedClientId = senderRole === MessageRole.CLIENT
      ? senderId
      : (clientId ?? senderId);
    if (!resolvedClientId) {
      throw new BadRequestException('Debes indicar el cliente al iniciar la conversación.');
    }

    const conversation = await this.prisma.conversation.upsert({
      where: { clientId_storeId: { clientId: resolvedClientId, storeId } },
      create: { clientId: resolvedClientId, storeId },
      update: { updatedAt: new Date() },
    });

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        senderRole,
        text: messageText,
        multimediaUrl,
        multimediaPublicId,
      },
    });

    return { ...message, conversationId: conversation.id, storeId };
  }

  // METODO PARA RESPONDER A UNA CONVERSACION EXISTENTE
  async replyMessage(
    senderId: string,
    conversationId: string,
    text: string | undefined,
    senderRole: MessageRole,
    multimediaUrl?: string,
    multimediaPublicId?: string,
  ) {
    const messageText = text?.trim() || undefined;
    if (!messageText && !multimediaUrl) {
      throw new BadRequestException('El mensaje debe tener texto o multimedia.');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, clientId: true, storeId: true, store: { select: { ownerId: true } } },
    });
    if (!conversation) {
      throw new BadRequestException('Conversación no encontrada.');
    }

    // Validar que el sender pertenece a esta conversación
    const isClient = conversation.clientId === senderId;
    const isVendor = conversation.store.ownerId === senderId;
    if (!isClient && !isVendor) {
      throw new BadRequestException('No tienes acceso a esta conversación.');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        senderRole,
        text: messageText,
        multimediaUrl,
        multimediaPublicId,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return { ...message, conversationId, storeId: conversation.storeId, clientId: conversation.clientId };
  }

  // METODO PARA OBTENER LOS MENSAJES DE UNA CONVERSACION ESPECIFICA, CON VALIDACION DE ACCESO
  async getMessages(conversationId: string, requestingUserId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { clientId: true, store: { select: { ownerId: true } } },
    });
    if (!conversation) throw new BadRequestException('Conversación no encontrada.');

    const isClient = conversation.clientId === requestingUserId;
    const isVendor = conversation.store.ownerId === requestingUserId;
    if (!isClient && !isVendor) {
      throw new BadRequestException('No tienes acceso a esta conversación.');
    }

    return this.prisma.message.findMany({
      where: { conversationId, createdAt: { gte: this.ttlCutoff() } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, conversationId: true, senderId: true, senderRole: true, text: true, multimediaUrl: true, read: true, createdAt: true },
    });
  }

  // METODO PARA OBTENER LOS CHATS DE UN USUARIO (CLIENTE O VENDEDOR), CON EL ULTIMO MENSAJE Y CONTADOR DE NO LEIDOS
  async getChats(userId: string, role: 'CLIENT' | 'VENDOR') {
    const cutoff = this.ttlCutoff();

    const conversations = await this.prisma.conversation.findMany({
      where: role === 'CLIENT'
        ? { clientId: userId }
        : { store: { ownerId: userId } },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        store:  { select: { id: true, name: true, logoUrl: true } },
        messages: {
          where: { createdAt: { gte: cutoff } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conv.id,
            read: false,
            senderId: { not: userId },
            createdAt: { gte: cutoff },
          },
        });

        const lastMessage = conv.messages[0] ?? null;

        return {
          conversationId: conv.id,
          store: { id: conv.store.id, name: conv.store.name, logoUrl: conv.store.logoUrl },
          client: {
            id: conv.client.id,
            name: [conv.client.firstName, conv.client.lastName].filter(Boolean).join(' ') || 'Cliente',
            avatarUrl: conv.client.avatarUrl,
          },
          lastMessage: lastMessage?.text ?? null,
          lastMessageAt: lastMessage?.createdAt ?? conv.createdAt,
          unreadCount,
        };
      }),
    );
  }

  // METODO PARA MARCAR LOS MENSAJES DE UNA CONVERSACION COMO LEIDOS POR EL USUARIO QUE LOS RECIBE
  async markAsRead(conversationId: string, userId: string) {
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        read: false,
      },
      data: { read: true },
    });
    return { success: true };
  }
}
