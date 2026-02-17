import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateContractDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  contractType!: string;

  @IsInt()
  @Min(0)
  contractValueCents!: number;

  @IsString()
  @IsOptional()
  riskTier?: string;

  @IsString()
  @IsOptional()
  clauseSetId?: string;

  @IsString({ each: true })
  @IsOptional()
  clauseKeys?: string[];

  @IsString()
  @IsOptional()
  title?: string;
}
