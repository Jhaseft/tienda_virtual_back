import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSystemConfigDto {
  @ApiPropertyOptional({ description: 'Días de prueba para nuevas tiendas' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  trialDays?: number;

  @ApiPropertyOptional({ description: 'Máximo de productos en periodo de prueba' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  trialMaxProducts?: number;

  @ApiPropertyOptional({ description: 'Tipo de cambio USD → BOB' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  exchangeRateBob?: number;
}
