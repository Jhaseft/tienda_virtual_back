import { Type } from 'class-transformer';
import { IsArray, IsHexColor, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProductSizeDto {
  @IsString()
  @MinLength(1)
  size: string;
}

export class ProductColorDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsHexColor()
  hexCode?: string;
}

export class SetProductOptionsDto {
  @ApiPropertyOptional({ type: [ProductSizeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSizeDto)
  sizes?: ProductSizeDto[];

  @ApiPropertyOptional({ type: [ProductColorDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductColorDto)
  colors?: ProductColorDto[];
}
