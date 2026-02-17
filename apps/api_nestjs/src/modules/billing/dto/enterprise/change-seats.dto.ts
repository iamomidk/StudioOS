import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class ChangeEnterpriseSeatsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsString()
  componentCode?: string;

  @IsInt()
  @Min(0)
  quantity!: number;
}
