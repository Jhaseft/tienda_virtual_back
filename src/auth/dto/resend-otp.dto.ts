import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { OtpType } from '@prisma/client';

export class ResendOtpDto {
  @ApiProperty({ example: 'usuario@correo.com' })
  @IsString()
  target: string;

  @ApiProperty({ enum: OtpType })
  @IsEnum(OtpType)
  type: OtpType;
}
