import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const MEMBERSHIP_ROLES = ['owner', 'manager', 'shooter', 'editor', 'renter', 'client'] as const;

export class UpsertProvisionedUserDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsIn(MEMBERSHIP_ROLES)
  role!: (typeof MEMBERSHIP_ROLES)[number];

  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;
}
