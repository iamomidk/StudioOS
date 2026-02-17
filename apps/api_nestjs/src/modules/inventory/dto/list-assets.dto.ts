import { IsOptional, IsString, MinLength } from 'class-validator';

export class ListAssetsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;
}
