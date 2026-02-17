import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateRoadmapScorecardDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsIn(['weekly', 'monthly'])
  frequency!: 'weekly' | 'monthly';

  @IsInt()
  @Min(7)
  @Max(90)
  @IsOptional()
  windowDays?: number;

  @IsString()
  @IsOptional()
  experimentId?: string;
}
