import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUrl } from 'class-validator';
import { SocialNetwork } from '@prisma/client';

export class UpdateSocialLinkDto {
  @ApiPropertyOptional({ enum: SocialNetwork })
  @IsOptional()
  @IsEnum(SocialNetwork)
  network?: SocialNetwork;

  @ApiPropertyOptional({ example: 'https://instagram.com/mitienda' })
  @IsOptional()
  @IsUrl()
  url?: string;
}
