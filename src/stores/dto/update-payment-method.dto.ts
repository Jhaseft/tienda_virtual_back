import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdatePaymentMethodDto {
  @ApiPropertyOptional({ example: 'uuid-del-metodo' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiPropertyOptional({ example: 'Banco Union' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: 'Juan Perez' })
  @IsOptional()
  @IsString()
  accountHolder?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../qr.png' })
  @IsOptional()
  @IsString()
  qrImageUrl?: string;

  @ApiPropertyOptional({ example: 'stores/qr_123' })
  @IsOptional()
  @IsString()
  qrImagePublicId?: string;
}
