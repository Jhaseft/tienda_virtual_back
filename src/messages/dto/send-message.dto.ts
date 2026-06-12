import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  storeId: string;

  @IsString()
  @MinLength(1)
  text: string;

  @IsUUID()
  @IsOptional()
  clientId?: string;
}

export class ReplyMessageDto {
  @IsUUID()
  conversationId: string;

  @IsString()
  @MinLength(1)
  text: string;
}

export class MarkAsReadDto {
  @IsUUID()
  conversationId: string;
}
