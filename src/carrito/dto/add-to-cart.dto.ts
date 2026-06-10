import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AddToCartDto {
  @IsUUID() productId!: string;
  @IsUUID() storeId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsString() @IsOptional() variant?: string;
  @IsString() @IsOptional() colorName?: string;
}
