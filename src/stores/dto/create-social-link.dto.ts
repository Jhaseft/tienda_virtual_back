import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUrl } from 'class-validator';
import { SocialNetwork } from '@prisma/client';

export class CreateSocialLinkDto {
  @ApiProperty({ enum: SocialNetwork })
  @IsEnum(SocialNetwork)
  network!: SocialNetwork;

  @ApiProperty({ example: 'https://instagram.com/mitienda' })
  @IsUrl()
  url!: string;
}
