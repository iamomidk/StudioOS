import { IsIn } from 'class-validator';

const STATUSES = ['active', 'suspended', 'revoked'] as const;

export class UpdatePartnerCredentialStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
