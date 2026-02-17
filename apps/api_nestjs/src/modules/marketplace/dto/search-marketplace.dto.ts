import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SearchMarketplaceDto {
  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minPriceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxPriceCents?: number;

  @IsString()
  organizationId!: string;
}
