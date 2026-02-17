import { IsString, MinLength } from 'class-validator';

export class ConvertLeadDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;
}
