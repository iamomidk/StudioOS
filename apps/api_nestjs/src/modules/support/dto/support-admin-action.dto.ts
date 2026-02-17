import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SupportAdminActionDto {
  @IsString()
  organizationId!: string;

  @IsString()
  ticketId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referenceId?: string;
}
