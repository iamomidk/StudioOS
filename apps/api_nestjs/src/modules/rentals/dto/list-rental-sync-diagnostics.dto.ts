import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class ListRentalSyncDiagnosticsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  deviceSessionId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
