import { IsOptional, IsString, MinLength } from 'class-validator';

export class RotatePartnerCredentialDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
