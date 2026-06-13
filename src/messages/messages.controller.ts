import { Body, Controller, Get, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessageRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { MarkAsReadDto, ReplyMessageDto, SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly gateway: MessagesGateway,
  ) {}

  // POST /messages — cliente inicia conversación con una tienda
  @Post()
  async sendMessage(
    @CurrentUser() user: JwtUser,
    @Body() body: SendMessageDto,
  ) {
    const senderRole = user.role === 'VENDOR' ? MessageRole.VENDOR : MessageRole.CLIENT;
    const message = await this.messagesService.createMessage(
      user.userId,
      body.storeId,
      body.text,
      senderRole,
      body.clientId,
    );
    this.gateway.sendMessageToStore(body.storeId, message);
    return message;
  }

  // POST /messages/reply — responder en una conversación existente
  @Post('reply')
  async replyMessage(
    @CurrentUser() user: JwtUser,
    @Body() body: ReplyMessageDto,
  ) {
    const senderRole = user.role === 'VENDOR' ? MessageRole.VENDOR : MessageRole.CLIENT;
    const message = await this.messagesService.replyMessage(
      user.userId,
      body.conversationId,
      body.text,
      senderRole,
    );
    this.gateway.sendMessageToStore(message.storeId, message);
    return message;
  }

  // GET /messages?conversationId=xxx — historial de una conversación
  @Get()
  getMessages(
    @CurrentUser() user: JwtUser,
    @Query('conversationId') conversationId: string,
  ) {
    return this.messagesService.getMessages(conversationId, user.userId);
  }

  // GET /messages/chats?role=CLIENT|VENDOR — lista de conversaciones del usuario
  @Get('chats')
  getChats(
    @CurrentUser() user: JwtUser,
    @Query('role') roleParam?: string,
  ) {
    const role = roleParam === 'VENDOR' ? 'VENDOR' : roleParam === 'CLIENT' ? 'CLIENT' : user.role === 'VENDOR' ? 'VENDOR' : 'CLIENT';
    return this.messagesService.getChats(user.userId, role);
  }

  // POST /messages/upload-multimedia — subir imagen/video antes de enviar el mensaje
  @Post('upload-multimedia')
  @UseInterceptors(FileInterceptor('file'))
  uploadMultimedia(
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.messagesService.uploadMultimedia(file);
  }

  // POST /messages/read — marcar mensajes como leídos
  @Post('read')
  markAsRead(
    @CurrentUser() user: JwtUser,
    @Body() body: MarkAsReadDto,
  ) {
    return this.messagesService.markAsRead(body.conversationId, user.userId);
  }
}
