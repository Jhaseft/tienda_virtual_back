import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateStoreDto {
  @ApiPropertyOptional({ example: 'Mi tienda medica' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'Uniformes medicos de calidad' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '+59171234567' })
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiPropertyOptional({ example: 'Av. America #123' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Santa Cruz' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'stores/logo_123' })
  @IsOptional()
  @IsString()
  logoPublicId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
