import { IsNotEmpty, IsString } from 'class-validator';

export class CreateModerationAppealDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
