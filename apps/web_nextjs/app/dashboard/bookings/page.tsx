'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { filterBookingsByStatus } from '@/lib/bookings';

interface Booking {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
}

export default function BookingsPage() {
  const [organizationId, setOrganizationId] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? ''
  );
  const [statusFilter, setStatusFilter] = useState('all');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const canQuery = organizationId.trim().length > 0;

  const loadBookings = useCallback(async (): Promise<void> => {
    if (!canQuery) {
      return;
    }

    const response = await fetch(
      `/api/bookings?organizationId=${encodeURIComponent(organizationId)}`
    );
    if (!response.ok) {
      setMessage('Unable to load bookings.');
      return;
    }

    setMessage(null);
    setBookings((await response.json()) as Booking[]);
  }, [canQuery, organizationId]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const visibleBookings = useMemo(
    () => filterBookingsByStatus(bookings, statusFilter),
    [bookings, statusFilter]
  );

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Bookings</h1>
      <p style={{ color: 'var(--muted)' }}>List + filter view for booking management.</p>

      <label>
        Organization ID
        <input
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          style={{ width: '100%', marginTop: 6, marginBottom: 10, padding: 10, maxWidth: 520 }}
        />
      </label>

      <label>
        Status Filter
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          style={{ marginLeft: 8 }}
        >
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
      </label>

      <div style={{ marginTop: 10 }}>
        <button type="button" onClick={() => void loadBookings()} style={{ padding: '8px 12px' }}>
          Refresh
        </button>
      </div>

      {message && <p>{message}</p>}

      <ul style={{ paddingLeft: 18 }}>
        {visibleBookings.map((booking) => (
          <li key={booking.id} style={{ marginBottom: 10 }}>
            <strong>{booking.title}</strong> ({booking.status}) -{' '}
            {new Date(booking.startsAt).toLocaleString()} to{' '}
            {new Date(booking.endsAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </main>
  );
}
