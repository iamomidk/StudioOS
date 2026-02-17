import { IsString, MinLength } from 'class-validator';

export class ListEnterpriseSettingsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;
}
