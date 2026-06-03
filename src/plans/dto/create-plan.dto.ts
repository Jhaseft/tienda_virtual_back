import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Precio en BOB' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: '-1 = ilimitado' })
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  maxProducts: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canAddPaymentMethods?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasAiAgent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasAdvancedPayments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
