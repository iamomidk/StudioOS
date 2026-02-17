import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClauseSetDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  clauses!: Array<Record<string, unknown>>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredClauseKeys?: string[];
}
