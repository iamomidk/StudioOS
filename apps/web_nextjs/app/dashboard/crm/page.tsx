'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { filterBookingsByStatus } from '@/lib/bookings';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

interface ConvertResult {
  client: {
    id: string;
    name: string;
  };
}

interface Quote {
  id: string;
  clientId: string;
  title: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  booking?: { id: string } | null;
}

interface Booking {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
}

export default function CrmPage() {
  const [organizationId, setOrganizationId] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? ''
  );
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [quoteClientId, setQuoteClientId] = useState('');
  const [quoteTitle, setQuoteTitle] = useState('Standard Package');
  const [quoteStartsAt, setQuoteStartsAt] = useState('2026-12-01T09:00:00.000Z');
  const [quoteEndsAt, setQuoteEndsAt] = useState('2026-12-01T17:00:00.000Z');
  const [quoteAmountCents, setQuoteAmountCents] = useState('100000');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canQuery = useMemo(() => organizationId.trim().length > 0, [organizationId]);

  const loadLeads = useCallback(async (): Promise<void> => {
    if (!canQuery) {
      return;
    }

    setLoading(true);
    setInfoMessage(null);
    const response = await fetch(
      `/api/crm/leads?organizationId=${encodeURIComponent(organizationId)}`
    );
    setLoading(false);

    if (!response.ok) {
      setInfoMessage('Unable to load leads. Check auth and organization ID.');
      return;
    }

    const data = (await response.json()) as Lead[];
    setLeads(data);
  }, [canQuery, organizationId]);

  const loadQuotes = useCallback(async (): Promise<void> => {
    if (!canQuery) {
      return;
    }

    const response = await fetch(
      `/api/crm/quotes?organizationId=${encodeURIComponent(organizationId)}`
    );
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as Quote[];
    setQuotes(data);
  }, [canQuery, organizationId]);

  const loadBookings = useCallback(async (): Promise<void> => {
    if (!canQuery) {
      return;
    }

    const response = await fetch(
      `/api/bookings?organizationId=${encodeURIComponent(organizationId)}`
    );
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as Booking[];
    setBookings(data);
  }, [canQuery, organizationId]);

  useEffect(() => {
    void loadLeads();
    void loadQuotes();
    void loadBookings();
  }, [loadBookings, loadLeads, loadQuotes]);

  async function onCreateLead(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canQuery || !leadName.trim()) {
      setInfoMessage('Organization ID and lead name are required.');
      return;
    }

    const response = await fetch('/api/crm/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        name: leadName.trim(),
        email: leadEmail.trim() || undefined
      })
    });

    if (!response.ok) {
      setInfoMessage('Create lead failed.');
      return;
    }

    setLeadName('');
    setLeadEmail('');
    setInfoMessage('Lead created.');
    await loadLeads();
  }

  async function onConvertLead(leadId: string): Promise<void> {
    const response = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId })
    });

    if (!response.ok) {
      setInfoMessage('Lead conversion failed.');
      return;
    }

    const result = (await response.json()) as ConvertResult;
    setInfoMessage(`Lead converted to client ${result.client.name}.`);
    setQuoteClientId(result.client.id);
    await loadLeads();
  }

  async function onCreateQuote(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canQuery || !quoteClientId.trim()) {
      setInfoMessage('Organization ID and client ID are required for quote creation.');
      return;
    }

    const amount = Number(quoteAmountCents);
    if (!Number.isInteger(amount) || amount <= 0) {
      setInfoMessage('Quote amount must be a positive integer.');
      return;
    }

    const response = await fetch('/api/crm/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        clientId: quoteClientId.trim(),
        title: quoteTitle.trim(),
        startsAt: quoteStartsAt,
        endsAt: quoteEndsAt,
        items: [{ description: quoteTitle.trim(), quantity: 1, unitPriceCents: amount }]
      })
    });

    if (!response.ok) {
      setInfoMessage('Quote creation failed.');
      return;
    }

    setInfoMessage('Quote created.');
    await loadQuotes();
  }

  async function onSendAndAcceptQuote(quoteId: string): Promise<void> {
    const sendResponse = await fetch(`/api/crm/quotes/${encodeURIComponent(quoteId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, status: 'sent' })
    });

    if (!sendResponse.ok && sendResponse.status !== 200) {
      setInfoMessage('Quote send failed.');
      return;
    }

    const acceptResponse = await fetch(`/api/crm/quotes/${encodeURIComponent(quoteId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, status: 'accepted' })
    });

    if (!acceptResponse.ok) {
      setInfoMessage('Quote acceptance failed.');
      return;
    }

    setInfoMessage('Quote accepted and booking draft created.');
    await loadQuotes();
    await loadBookings();
  }

  const visibleBookings = useMemo(
    () => filterBookingsByStatus(bookings, bookingStatusFilter),
    [bookings, bookingStatusFilter]
  );

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>CRM Leads</h1>
      <p style={{ color: 'var(--muted)' }}>
        Lead to booking MVP flow: create lead, convert to client, create quote, accept quote.
      </p>

      <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
        <label>
          Organization ID
          <input
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            style={{ width: '100%', marginTop: 6, padding: 10 }}
          />
        </label>

        <form onSubmit={(event) => void onCreateLead(event)} style={{ display: 'grid', gap: 10 }}>
          <label>
            Lead Name
            <input
              value={leadName}
              onChange={(event) => setLeadName(event.target.value)}
              style={{ width: '100%', marginTop: 6, padding: 10 }}
            />
          </label>
          <label>
            Lead Email
            <input
              type="email"
              value={leadEmail}
              onChange={(event) => setLeadEmail(event.target.value)}
              style={{ width: '100%', marginTop: 6, padding: 10 }}
            />
          </label>
          <button
            type="submit"
            style={{
              width: 'fit-content',
              border: 0,
              borderRadius: 8,
              padding: '8px 12px',
              background: 'var(--accent)',
              color: '#fff'
            }}
          >
            Create Lead
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            void loadLeads();
            void loadQuotes();
            void loadBookings();
          }}
          style={{ width: 'fit-content', padding: '8px 12px' }}
        >
          Refresh CRM Data
        </button>

        {loading && <p>Loading leads...</p>}
        {infoMessage && <p>{infoMessage}</p>}

        <ul style={{ paddingLeft: 18 }}>
          {leads.map((lead) => (
            <li key={lead.id} style={{ marginBottom: 10 }}>
              <strong>{lead.name}</strong> ({lead.status}){lead.email ? ` - ${lead.email}` : ''}
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => void onConvertLead(lead.id)}
                  disabled={lead.status === 'converted'}
                  style={{ padding: '4px 8px' }}
                >
                  Convert to Client
                </button>
              </div>
            </li>
          ))}
        </ul>

        <h2 style={{ marginBottom: 6 }}>Quotes</h2>
        <form onSubmit={(event) => void onCreateQuote(event)} style={{ display: 'grid', gap: 10 }}>
          <label>
            Client ID
            <input
              value={quoteClientId}
              onChange={(event) => setQuoteClientId(event.target.value)}
              style={{ width: '100%', marginTop: 6, padding: 10 }}
            />
          </label>
          <label>
            Quote Title
            <input
              value={quoteTitle}
              onChange={(event) => setQuoteTitle(event.target.value)}
              style={{ width: '100%', marginTop: 6, padding: 10 }}
            />
          </label>
          <label>
            Starts At (ISO)
            <input
              value={quoteStartsAt}
              onChange={(event) => setQuoteStartsAt(event.target.value)}
              style={{ width: '100%', marginTop: 6, padding: 10 }}
            />
          </label>
          <label>
            Ends At (ISO)
            <input
              value={quoteEndsAt}
              onChange={(event) => setQuoteEndsAt(event.target.value)}
              style={{ width: '100%', marginTop: 6, padding: 10 }}
            />
          </label>
          <label>
            Amount (cents)
            <input
              value={quoteAmountCents}
              onChange={(event) => setQuoteAmountCents(event.target.value)}
              style={{ width: '100%', marginTop: 6, padding: 10 }}
            />
          </label>
          <button
            type="submit"
            style={{
              width: 'fit-content',
              border: 0,
              borderRadius: 8,
              padding: '8px 12px',
              background: 'var(--accent)',
              color: '#fff'
            }}
          >
            Create Quote
          </button>
        </form>

        <ul style={{ paddingLeft: 18 }}>
          {quotes.map((quote) => (
            <li key={quote.id} style={{ marginBottom: 10 }}>
              <strong>{quote.title}</strong> ({quote.status}) - client {quote.clientId}
              {quote.booking?.id ? ` - booking ${quote.booking.id}` : ''}
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => void onSendAndAcceptQuote(quote.id)}
                  disabled={quote.status !== 'draft'}
                  style={{ padding: '4px 8px' }}
                >
                  Send + Accept (Create Booking)
                </button>
              </div>
            </li>
          ))}
        </ul>

        <h2 style={{ marginBottom: 6 }}>Bookings</h2>
        <label>
          Status Filter
          <select
            value={bookingStatusFilter}
            onChange={(event) => setBookingStatusFilter(event.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </label>

        <ul style={{ paddingLeft: 18 }}>
          {visibleBookings.map((booking) => (
            <li key={booking.id} style={{ marginBottom: 8 }}>
              <strong>{booking.title}</strong> ({booking.status}) -{' '}
              {new Date(booking.startsAt).toLocaleString()} to{' '}
              {new Date(booking.endsAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
