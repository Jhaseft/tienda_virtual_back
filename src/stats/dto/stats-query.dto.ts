import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export type StatsPeriod = 'today' | 'week' | 'month' | 'year';

export class StatsQueryDto {
  @ApiPropertyOptional({
    enum: ['today', 'week', 'month', 'year'],
    default: 'month',
  })
  @IsOptional()
  @IsIn(['today', 'week', 'month', 'year'])
  period: StatsPeriod = 'month';
}
