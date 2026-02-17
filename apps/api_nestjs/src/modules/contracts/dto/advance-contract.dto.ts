import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const contractActions = [
  'submit_legal_review',
  'submit_business_approval',
  'send_for_signature',
  'mark_signed',
  'activate'
] as const;

export type ContractAction = (typeof contractActions)[number];

export class AdvanceContractDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsEnum(contractActions)
  action!: ContractAction;

  @IsString()
  @IsOptional()
  reason?: string;
}
