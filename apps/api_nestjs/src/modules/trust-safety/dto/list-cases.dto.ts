import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsIn } from 'class-validator';

const moderationStatuses = ['open', 'in_review', 'resolved', 'appealed', 'closed'] as const;

export class ListModerationCasesDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsIn(moderationStatuses)
  @IsOptional()
  status?: (typeof moderationStatuses)[number];

  @IsString()
  @IsOptional()
  violationType?: string;
}
