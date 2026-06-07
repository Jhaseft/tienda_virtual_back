import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateSubdomainDto {
  @ApiProperty({
    example: 'mitienda',
    description:
      'Solo minúsculas, números y guiones. Entre 2 y 63 caracteres. No puede empezar ni terminar con guion.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(63)
  @Matches(/^(?!-)[a-z0-9-]+(?<!-)$/, {
    message:
      'Subdominio inválido. Usa minúsculas, números y guiones (sin empezar/terminar con guion).',
  })
  subdomain!: string;
}
