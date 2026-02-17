import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const ASSET_CONDITIONS = ['excellent', 'good', 'fair', 'damaged'] as const;

export class ListInventoryItemsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assetId?: string;

  @IsOptional()
  @IsIn(ASSET_CONDITIONS)
  condition?: (typeof ASSET_CONDITIONS)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;
}
