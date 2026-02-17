import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SignatureWebhookDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  providerEventId!: string;

  @IsIn(['signed', 'declined', 'expired'])
  status!: 'signed' | 'declined' | 'expired';

  @IsString()
  @IsOptional()
  providerRef?: string;
}
