import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const ASSET_CONDITIONS = ['excellent', 'good', 'fair', 'damaged'] as const;

export class CreateInventoryItemDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  assetId!: string;

  @IsString()
  @MinLength(1)
  serialNumber!: string;

  @IsIn(ASSET_CONDITIONS)
  condition!: (typeof ASSET_CONDITIONS)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  ownerName?: string;
}
