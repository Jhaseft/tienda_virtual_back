import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ example: '115234567890123456789' })
  @IsString()
  googleId: string;

  @ApiProperty({ example: 'usuario@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Juan Pérez', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'https://lh3.googleusercontent.com/...', required: false })
  @IsString()
  @IsOptional()
  picture?: string;
}
