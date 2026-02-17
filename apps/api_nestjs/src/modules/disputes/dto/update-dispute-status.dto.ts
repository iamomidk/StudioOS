import { IsIn } from 'class-validator';

const DISPUTE_STATUSES = ['open', 'under_review', 'resolved', 'rejected'] as const;

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export class UpdateDisputeStatusDto {
  @IsIn(DISPUTE_STATUSES)
  status!: DisputeStatus;
}
