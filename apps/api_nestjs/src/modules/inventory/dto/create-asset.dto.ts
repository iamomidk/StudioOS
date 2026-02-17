import { IsString, MinLength } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  category!: string;
}
