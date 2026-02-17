export interface BookingListItem {
  status: string;
}

export function filterBookingsByStatus<T extends BookingListItem>(
  bookings: T[],
  status: string
): T[] {
  if (status === 'all') {
    return bookings;
  }
  return bookings.filter((booking) => booking.status === status);
}
