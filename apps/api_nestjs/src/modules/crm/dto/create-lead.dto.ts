import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
