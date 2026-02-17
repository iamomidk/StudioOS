export type RentalStatus = 'reserved' | 'picked_up' | 'returned' | 'incident' | 'cancelled';

const NEXT_STATUS: Record<RentalStatus, RentalStatus[]> = {
  reserved: ['picked_up', 'cancelled'],
  picked_up: ['returned', 'incident'],
  incident: ['returned', 'cancelled'],
  returned: [],
  cancelled: []
};

export function getNextRentalStatuses(status: RentalStatus): RentalStatus[] {
  return NEXT_STATUS[status];
}

export function formatRentalStatus(status: RentalStatus): string {
  return status.replace('_', ' ');
}
