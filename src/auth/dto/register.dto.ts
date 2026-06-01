import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'usuario@correo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: '+59171234567' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ example: 'miPassword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
