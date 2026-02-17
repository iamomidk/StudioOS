import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class VersionStrategicMetricDefinitionDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  formula!: string;

  @IsNumber()
  @Min(0)
  targetValue!: number;

  @IsString()
  @IsOptional()
  changeReason?: string;
}
