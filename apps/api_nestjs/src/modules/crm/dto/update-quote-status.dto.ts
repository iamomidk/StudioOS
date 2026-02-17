import { IsEnum } from 'class-validator';

const quoteStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const;

export class UpdateQuoteStatusDto {
  @IsEnum(quoteStatuses)
  status!: (typeof quoteStatuses)[number];
}
