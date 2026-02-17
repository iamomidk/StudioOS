import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateModerationPolicyDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  violationTypes!: string[];

  @IsArray()
  @IsString({ each: true })
  keywordRules!: string[];
}
