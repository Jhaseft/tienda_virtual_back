import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAddressDto {
  @IsString() @IsOptional() fullName?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @MinLength(3) street!: string;
  @IsString() @MinLength(2) city!: string;
  @IsString() @IsOptional() state?: string;
  @IsString() @IsOptional() zipCode?: string;
  @IsString() @IsOptional() country?: string;
  @IsBoolean() @IsOptional() isDefault?: boolean;
}
