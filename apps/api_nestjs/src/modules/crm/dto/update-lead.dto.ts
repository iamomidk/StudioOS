import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

const leadStatuses = ['new', 'contacted', 'qualified', 'archived'] as const;

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(leadStatuses)
  status?: (typeof leadStatuses)[number];
}
