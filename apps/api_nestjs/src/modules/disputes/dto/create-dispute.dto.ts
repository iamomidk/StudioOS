import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  entityType!: string;

  @IsString()
  @MinLength(1)
  entityId!: string;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsOptional()
  @IsString()
  evidenceLink?: string;
}
