'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

interface Ticket {
  id: string;
  title: string;
  severity: 'p0' | 'p1' | 'p2' | 'p3';
  status: 'open' | 'triaged' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
}

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? '';

export default function SupportPage() {
  const [organizationId, setOrganizationId] = useState(DEFAULT_ORG_ID);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Ticket['severity']>('p2');
  const [statusFilter, setStatusFilter] = useState<'all' | Ticket['status']>('all');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    const params = new URLSearchParams({ organizationId });
    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    }

    const response = await fetch(`/api/support/tickets?${params.toString()}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      setMessage('Unable to load tickets.');
      return;
    }

    setTickets((await response.json()) as Ticket[]);
  }, [organizationId, statusFilter]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        title,
        description,
        severity,
        routePath: '/dashboard/support',
        screenName: 'support-dashboard',
        source: 'web'
      })
    });

    if (!response.ok) {
      const body = (await response
        .json()
        .catch(() => ({ message: 'Failed to submit support ticket.' }))) as {
        message?: string;
      };
      setMessage(body.message ?? 'Failed to submit support ticket.');
      return;
    }

    setTitle('');
    setDescription('');
    setSeverity('p2');
    setMessage('Support ticket submitted.');
    await loadTickets();
  }

  async function updateStatus(ticketId: string, nextStatus: Ticket['status']) {
    const response = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, status: nextStatus })
    });

    if (!response.ok) {
      setMessage('Unable to update ticket status.');
      return;
    }

    await loadTickets();
  }

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Support Console</h1>
      <p style={{ color: '#555' }}>Report issues with route, app version, and request context.</p>

      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        style={{ display: 'grid', gap: 10, maxWidth: 560 }}
      >
        <input
          value={organizationId}
          placeholder="Organization ID"
          onChange={(event) => setOrganizationId(event.target.value)}
          required
        />
        <input
          value={title}
          placeholder="Issue title"
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <textarea
          value={description}
          placeholder="Describe issue"
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          required
        />
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as Ticket['severity'])}
        >
          <option value="p0">P0</option>
          <option value="p1">P1</option>
          <option value="p2">P2</option>
          <option value="p3">P3</option>
        </select>
        <button type="submit" style={{ padding: '8px 12px' }}>
          Report Issue
        </button>
      </form>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Tickets</h2>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Status filter:{' '}
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | Ticket['status'])}
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="triaged">Triaged</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <button
          type="button"
          style={{ padding: '6px 10px', marginBottom: 12 }}
          onClick={() => void loadTickets()}
        >
          Refresh
        </button>

        {tickets.length === 0 ? <p>No tickets found.</p> : null}
        {tickets.map((ticket) => (
          <article
            key={ticket.id}
            style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 10 }}
          >
            <strong>{ticket.title}</strong>
            <p style={{ margin: '6px 0' }}>
              {ticket.severity.toUpperCase()} • {ticket.status}
            </p>
            <small>{new Date(ticket.createdAt).toLocaleString()}</small>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => void updateStatus(ticket.id, 'triaged')}>
                Mark Triaged
              </button>
              <button type="button" onClick={() => void updateStatus(ticket.id, 'in_progress')}>
                Mark In Progress
              </button>
              <button type="button" onClick={() => void updateStatus(ticket.id, 'resolved')}>
                Mark Resolved
              </button>
            </div>
          </article>
        ))}
      </section>

      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
    </main>
  );
}
