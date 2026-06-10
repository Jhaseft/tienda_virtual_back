import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsString, Min } from 'class-validator';
import { TransportType } from '@prisma/client';

export class CreateShippingZoneDto {
  @ApiProperty({ example: 'Cochabamba' })
  @IsString()
  city!: string;

  @ApiProperty({ enum: TransportType })
  @IsEnum(TransportType)
  transportType!: TransportType;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0)
  shippingCost!: number;

  @ApiProperty({ example: 2, description: 'Mínimo de horas de entrega' })
  @IsInt()
  @Min(0)
  minHours!: number;

  @ApiProperty({ example: 24, description: 'Máximo de horas de entrega' })
  @IsInt()
  @Min(1)
  maxHours!: number;
}
