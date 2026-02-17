import { IsString, MinLength } from 'class-validator';

export class RequestPurgeDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(5)
  reason!: string;
}
