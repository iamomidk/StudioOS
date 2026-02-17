import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class ListRiskEvaluationsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
