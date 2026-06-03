import { IsUUID } from 'class-validator';

export class InitQrPaymentDto {
  @IsUUID()
  planId: string;
}
