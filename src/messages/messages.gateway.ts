import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessageRole, UserRole } from '@prisma/client';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma.service';

type RegisteredSocketUser = {
  userId: string;
  role: UserRole;
  storeId: string | null;
};

type RegisterPayload = string | { userId?: string; token?: string };

@WebSocketGateway({ cors: { origin: '*' } })
export class MessagesGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(MessagesGateway.name);
  private readonly socketUsers = new Map<string, RegisteredSocketUser>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  handleDisconnect(client: Socket) {
    const socketUser = this.socketUsers.get(client.id);
    this.logger.log(
      `[socket_disconnect] socketId=${client.id} userId=${socketUser?.userId ?? 'unknown'}`,
    );
    this.socketUsers.delete(client.id);
  }

  private getBearerToken(rawValue: unknown): string | null {
    if (Array.isArray(rawValue)) return this.getBearerToken(rawValue[0]);
    if (typeof rawValue !== 'string') return null;
    const value = rawValue.trim();
    if (!value) return null;
    if (value.toLowerCase().startsWith('bearer ')) return value.slice(7).trim() || null;
    return value;
  }

  private getTokenFromSocket(client: Socket, payload?: RegisterPayload): string | null {
    return (
      this.getBearerToken(client.handshake.auth?.token) ??
      this.getBearerToken(client.handshake.headers?.authorization) ??
      this.getBearerToken(client.handshake.query?.token) ??
      (payload && typeof payload !== 'string' ? this.getBearerToken(payload.token) : null)
    );
  }

  private async resolveSocketUser(
    client: Socket,
    payload?: RegisterPayload,
  ): Promise<RegisteredSocketUser | null> {
    const cached = this.socketUsers.get(client.id);
    if (cached) return cached;

    const token = this.getTokenFromSocket(client, payload);
    if (!token) return null;

    try {
      const jwtPayload = await this.jwtService.verifyAsync<{ sub?: string; role?: UserRole }>(token);
      if (!jwtPayload?.sub || !jwtPayload.role) return null;

      const user = await this.prisma.user.findUnique({
        where: { id: jwtPayload.sub },
        select: { id: true, role: true, store: { select: { id: true } } },
      });
      if (!user) return null;

      const resolved: RegisteredSocketUser = {
        userId: user.id,
        role: user.role,
        storeId: user.store?.id ?? null,
      };
      this.socketUsers.set(client.id, resolved);
      return resolved;
    } catch {
      return null;
    }
  }

  private async getRequiredSocketUser(
    client: Socket,
    payload?: RegisterPayload,
  ): Promise<RegisteredSocketUser | null> {
    const socketUser = await this.resolveSocketUser(client, payload);
    if (!socketUser) {
      client.emit('auth_error', { message: 'Sesión inválida. Inicia sesión nuevamente.' });
      return null;
    }
    return socketUser;
  }

  // Cliente o vendor se autentican y entran a sus rooms
  @SubscribeMessage('register')
  async handleRegister(
    @MessageBody() payload: RegisterPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const socketUser = await this.resolveSocketUser(client, payload);
    if (!socketUser) {
      client.emit('register_error', { message: 'No se pudo autenticar el socket.' });
      return;
    }

    // Todos entran a su room personal
    client.join(`user_${socketUser.userId}`);

    // Si es vendor y tiene tienda, entra también a la room de su tienda
    if (socketUser.role === UserRole.VENDOR && socketUser.storeId) {
      client.join(`store_${socketUser.storeId}`);
      this.logger.log(
        `[socket_registered] socketId=${client.id} userId=${socketUser.userId} role=VENDOR storeRoom=store_${socketUser.storeId}`,
      );
    } else {
      this.logger.log(
        `[socket_registered] socketId=${client.id} userId=${socketUser.userId} role=${socketUser.role}`,
      );
    }

    client.emit('registered', { userId: socketUser.userId });
  }

  // Cliente inicia una conversación con una tienda
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { storeId: string; text: string; clientId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const socketUser = await this.getRequiredSocketUser(client);
    if (!socketUser) return;

    if (!data?.storeId || !data?.text) {
      client.emit('message_error', { message: 'Faltan datos: storeId y text son requeridos.' });
      return;
    }

    const senderRole = socketUser.role === UserRole.VENDOR ? MessageRole.VENDOR : MessageRole.CLIENT;

    try {
      const message = await this.messagesService.createMessage(
        socketUser.userId,
        data.storeId,
        data.text,
        senderRole,
        data.clientId,
      );

      // Determinar el clientId real para emitir a su room
      const clientId = senderRole === MessageRole.CLIENT ? socketUser.userId : data.clientId;

      this.server.to(`store_${data.storeId}`).emit('new_message', message);
      if (clientId) this.server.to(`user_${clientId}`).emit('new_message', message);

      client.emit('message_sent', message);
    } catch (error: any) {
      client.emit('message_error', { message: error?.message ?? 'No se pudo enviar el mensaje.' });
    }
  }

  // Vendor o cliente responden en una conversación existente
  @SubscribeMessage('reply_message')
  async handleReplyMessage(
    @MessageBody() data: { conversationId: string; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    const socketUser = await this.getRequiredSocketUser(client);
    if (!socketUser) return;

    if (!data?.conversationId || !data?.text) {
      client.emit('message_error', { message: 'Faltan datos: conversationId y text son requeridos.' });
      return;
    }

    const senderRole = socketUser.role === UserRole.VENDOR ? MessageRole.VENDOR : MessageRole.CLIENT;

    try {
      const message = await this.messagesService.replyMessage(
        socketUser.userId,
        data.conversationId,
        data.text,
        senderRole,
      );

      // Emitir a ambos participantes
      this.server.to(`store_${message.storeId}`).emit('new_message', message);
      this.server.to(`user_${socketUser.userId}`).emit('new_message', message);

      client.emit('message_sent', message);
    } catch (error: any) {
      client.emit('message_error', { message: error?.message ?? 'No se pudo enviar el mensaje.' });
    }
  }

  // Método público para emitir desde el controller HTTP (fallback)
  sendMessageToUser(userId: string, message: any) {
    this.server.to(`user_${userId}`).emit('new_message', message);
  }

  sendMessageToStore(storeId: string, message: any) {
    this.server.to(`store_${storeId}`).emit('new_message', message);
  }
}
