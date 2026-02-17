import { IsString, MinLength } from 'class-validator';

export class ListPartnerCredentialsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;
}
