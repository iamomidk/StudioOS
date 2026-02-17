import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportAbuseDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsOptional()
  attachmentType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  attachmentUrl?: string;
}
