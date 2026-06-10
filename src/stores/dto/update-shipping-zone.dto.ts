import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TransportType } from '@prisma/client';

export class UpdateShippingZoneDto {
  @ApiPropertyOptional({ example: 'Cochabamba' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ enum: TransportType })
  @IsOptional()
  @IsEnum(TransportType)
  transportType?: TransportType;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minHours?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxHours?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
