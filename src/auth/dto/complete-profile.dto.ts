import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CompleteProfileDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: '+59171234567' })
  @IsString()
  phoneNumber: string;
}
