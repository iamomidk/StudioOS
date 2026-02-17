import { IsOptional, IsString, MinLength } from 'class-validator';

export class PartnerLeadCreateDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
