import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length } from 'class-validator';
import { OtpType } from '@prisma/client';

export class VerifyOtpDto {
  @ApiProperty({ example: 'usuario@correo.com' })
  @IsString()
  target: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({ enum: OtpType })
  @IsEnum(OtpType)
  type: OtpType;
}
