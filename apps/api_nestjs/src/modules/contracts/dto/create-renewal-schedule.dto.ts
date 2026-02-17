import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

export class CreateRenewalScheduleDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsDateString()
  renewAt!: string;

  @IsInt()
  @Min(1)
  @Max(180)
  @IsOptional()
  reminderDaysBefore?: number;

  @IsBoolean()
  @IsOptional()
  autoDraftAmendment?: boolean;
}
