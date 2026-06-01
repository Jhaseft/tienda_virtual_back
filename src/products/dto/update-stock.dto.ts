import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateStockDto {
  @ApiProperty({ example: 10, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock: number;
}
