import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAmendmentDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString({ each: true })
  @IsOptional()
  clauseKeys?: string[];
}
