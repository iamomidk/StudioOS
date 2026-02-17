import { IsOptional, IsString, MinLength } from 'class-validator';

export class DeactivateProvisionedUserDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(5)
  reason!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  ticketId?: string;
}
