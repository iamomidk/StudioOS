import { IsIn } from 'class-validator';

const RENTAL_STATUSES = ['reserved', 'picked_up', 'returned', 'incident', 'cancelled'] as const;

export type RentalLifecycleStatus = (typeof RENTAL_STATUSES)[number];

export class UpdateRentalStatusDto {
  @IsIn(RENTAL_STATUSES)
  status!: RentalLifecycleStatus;
}
