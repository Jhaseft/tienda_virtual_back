import { PaymentType, PickupMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class PedidoItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsString() @IsOptional() variant?: string;
  @IsString() @IsOptional() colorName?: string;
}

export class CreatePedidoDto {
  @IsUUID() storeId!: string;
  @IsUUID() addressId!: string;
  @IsUUID() @IsOptional() shippingZoneId?: string;
  @IsEnum(PickupMethod) @IsOptional() pickupMethod?: PickupMethod;
  @IsEnum(PaymentType) paymentMethod!: PaymentType;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PedidoItemDto) items!: PedidoItemDto[];
  @IsString() @IsOptional() note?: string;
}
