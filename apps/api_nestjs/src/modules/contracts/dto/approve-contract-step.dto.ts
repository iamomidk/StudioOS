import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveContractStepDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  approvalStepId!: string;

  @IsBoolean()
  approved!: boolean;

  @IsString()
  @IsOptional()
  note?: string;
}
