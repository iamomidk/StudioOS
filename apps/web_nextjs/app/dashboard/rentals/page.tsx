'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { formatRentalStatus, getNextRentalStatuses, type RentalStatus } from '@/lib/rentals';

interface RentalOrder {
  id: string;
  inventoryItemId: string;
  startsAt: string;
  endsAt: string;
  status: RentalStatus;
}

interface RentalEvidence {
  id: string;
  photoUrl: string;
  note: string;
  occurredAt: string;
}

interface EvidenceResponse {
  items: RentalEvidence[];
  nextCursor: string | null;
}

export default function RentalsPage() {
  const [organizationId, setOrganizationId] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? ''
  );
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [startsAt, setStartsAt] = useState('2026-12-02T09:00:00.000Z');
  const [endsAt, setEndsAt] = useState('2026-12-02T17:00:00.000Z');
  const [evidencePhotoUrl, setEvidencePhotoUrl] = useState('https://example.com/evidence.jpg');
  const [evidenceNote, setEvidenceNote] = useState('Check-out evidence');
  const [evidenceRentalOrderId, setEvidenceRentalOrderId] = useState('');
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [evidenceByOrder, setEvidenceByOrder] = useState<Record<string, RentalEvidence[]>>({});
  const [message, setMessage] = useState<string | null>(null);

  const canQuery = useMemo(() => organizationId.trim().length > 0, [organizationId]);

  const loadOrders = useCallback(async (): Promise<void> => {
    if (!canQuery) {
      return;
    }

    const response = await fetch(
      `/api/rentals?organizationId=${encodeURIComponent(organizationId)}`
    );
    if (!response.ok) {
      setMessage('Unable to load rental orders.');
      return;
    }

    const data = (await response.json()) as RentalOrder[];
    setOrders(data);
    const firstOrder = data.at(0);
    if (!evidenceRentalOrderId && firstOrder) {
      setEvidenceRentalOrderId(firstOrder.id);
    }
  }, [canQuery, evidenceRentalOrderId, organizationId]);

  const loadEvidence = useCallback(
    async (rentalOrderId: string): Promise<void> => {
      if (!canQuery) {
        return;
      }

      const response = await fetch(
        `/api/rentals/${encodeURIComponent(rentalOrderId)}/evidence?organizationId=${encodeURIComponent(organizationId)}`
      );
      if (!response.ok) {
        setMessage('Unable to load rental evidence.');
        return;
      }

      const data = (await response.json()) as EvidenceResponse;
      setEvidenceByOrder((previous) => ({ ...previous, [rentalOrderId]: data.items }));
    },
    [canQuery, organizationId]
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function onCreateRentalOrder(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canQuery || !inventoryItemId.trim()) {
      setMessage('Organization ID and inventory item ID are required.');
      return;
    }

    const response = await fetch('/api/rentals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        inventoryItemId: inventoryItemId.trim(),
        startsAt,
        endsAt
      })
    });

    if (!response.ok) {
      setMessage('Create reservation failed (check for overlap conflicts).');
      return;
    }

    setMessage('Reservation created.');
    await loadOrders();
  }

  async function onTransitionStatus(rentalOrderId: string, status: RentalStatus): Promise<void> {
    const response = await fetch(`/api/rentals/${encodeURIComponent(rentalOrderId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, status })
    });

    if (!response.ok) {
      setMessage('Status transition failed.');
      return;
    }

    setMessage(`Rental moved to ${formatRentalStatus(status)}.`);
    await loadOrders();
  }

  async function onCreateEvidence(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (
      !canQuery ||
      !evidenceRentalOrderId.trim() ||
      !evidencePhotoUrl.trim() ||
      !evidenceNote.trim()
    ) {
      setMessage('Organization ID, rental order, photo URL, and note are required.');
      return;
    }

    const response = await fetch(
      `/api/rentals/${encodeURIComponent(evidenceRentalOrderId)}/evidence`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          photoUrl: evidencePhotoUrl.trim(),
          note: evidenceNote.trim(),
          occurredAt: new Date().toISOString()
        })
      }
    );

    if (!response.ok) {
      setMessage('Create evidence failed.');
      return;
    }

    setMessage('Evidence added.');
    await loadEvidence(evidenceRentalOrderId);
  }

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Rentals</h1>
      <p style={{ color: 'var(--muted)' }}>
        Reservation lifecycle (reserve, pickup, return) with append-only evidence timeline.
      </p>

      <label>
        Organization ID
        <input
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          style={{ width: '100%', marginTop: 6, marginBottom: 10, padding: 10, maxWidth: 520 }}
        />
      </label>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ marginBottom: 8 }}>Create Reservation</h2>
        <form
          onSubmit={(event) => void onCreateRentalOrder(event)}
          style={{ display: 'grid', gap: 8, maxWidth: 520 }}
        >
          <input
            placeholder="Inventory item ID"
            value={inventoryItemId}
            onChange={(event) => setInventoryItemId(event.target.value)}
            style={{ padding: 10 }}
          />
          <input
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            style={{ padding: 10 }}
          />
          <input
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            style={{ padding: 10 }}
          />
          <button type="submit" style={{ padding: '8px 12px', width: 'fit-content' }}>
            Reserve
          </button>
        </form>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ marginBottom: 8 }}>Rental Orders</h2>
        <button type="button" onClick={() => void loadOrders()} style={{ padding: '8px 12px' }}>
          Refresh Rentals
        </button>
        <ul style={{ paddingLeft: 18 }}>
          {orders.map((order) => (
            <li key={order.id} style={{ marginBottom: 12 }}>
              <strong>{order.id.slice(0, 8)}</strong> - {formatRentalStatus(order.status)}
              <div>
                {new Date(order.startsAt).toLocaleString()} to{' '}
                {new Date(order.endsAt).toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {getNextRentalStatuses(order.status).map((nextStatus) => (
                  <button
                    key={nextStatus}
                    type="button"
                    onClick={() => void onTransitionStatus(order.id, nextStatus)}
                    style={{ padding: '6px 10px' }}
                  >
                    Mark {formatRentalStatus(nextStatus)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void loadEvidence(order.id)}
                  style={{ padding: '6px 10px' }}
                >
                  Load Evidence
                </button>
              </div>
              {evidenceByOrder[order.id] && (
                <ul style={{ marginTop: 8, paddingLeft: 16 }}>
                  {(evidenceByOrder[order.id] ?? []).map((entry) => (
                    <li key={entry.id}>
                      {new Date(entry.occurredAt).toLocaleString()} - {entry.note} ({entry.photoUrl}
                      )
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 style={{ marginBottom: 8 }}>Add Evidence</h2>
        <form
          onSubmit={(event) => void onCreateEvidence(event)}
          style={{ display: 'grid', gap: 8, maxWidth: 520 }}
        >
          <select
            value={evidenceRentalOrderId}
            onChange={(event) => setEvidenceRentalOrderId(event.target.value)}
            style={{ padding: 10 }}
          >
            <option value="">Select Rental Order</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.id.slice(0, 8)} ({formatRentalStatus(order.status)})
              </option>
            ))}
          </select>
          <input
            placeholder="Photo URL"
            value={evidencePhotoUrl}
            onChange={(event) => setEvidencePhotoUrl(event.target.value)}
            style={{ padding: 10 }}
          />
          <input
            placeholder="Note"
            value={evidenceNote}
            onChange={(event) => setEvidenceNote(event.target.value)}
            style={{ padding: 10 }}
          />
          <button type="submit" style={{ padding: '8px 12px', width: 'fit-content' }}>
            Append Evidence
          </button>
        </form>
      </section>

      {message && <p>{message}</p>}
    </main>
  );
}
