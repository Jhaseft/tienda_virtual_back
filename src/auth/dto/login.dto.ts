import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'usuario@correo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'miPassword123' })
  @IsString()
  @MinLength(8)
  password: string;
}
