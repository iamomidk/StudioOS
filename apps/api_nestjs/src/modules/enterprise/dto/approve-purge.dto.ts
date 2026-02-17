import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class ApprovePurgeDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(5)
  reason!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  executeNow?: boolean;
}
