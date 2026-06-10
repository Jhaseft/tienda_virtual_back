import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateAddressDto {
  @IsString() @MinLength(3) @IsOptional() street?: string;
  @IsString() @MinLength(2) @IsOptional() city?: string;
  @IsString() @IsOptional() state?: string;
  @IsString() @IsOptional() zipCode?: string;
  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() fullName?: string;
  @IsString() @IsOptional() phone?: string;
  @IsBoolean() @IsOptional() isDefault?: boolean;
}
