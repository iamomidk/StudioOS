import {
  durationMs,
  nowIso,
  toMarkdownReport,
  writeJson,
  writeText
} from './_reporting.mjs';

const ARTIFACT_JSON = 'artifacts/smoke/summary.json';
const ARTIFACT_MD = 'artifacts/smoke/summary.md';
const DEFAULT_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 300000);

async function checkJson(url, options = {}) {
  const response = await fetch(url, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`
  };
}

function smokeHeaders(smokeToken) {
  return {
    'x-smoke-token': smokeToken
  };
}

async function runCheck(name, fn) {
  const started = process.hrtime.bigint();
  try {
    await fn();
    return { name, status: 'PASS', durationMs: durationMs(started), failures: [] };
  } catch (error) {
    return {
      name,
      status: 'FAIL',
      durationMs: durationMs(started),
      failures: [error instanceof Error ? error.message : 'Unknown smoke failure']
    };
  }
}

async function main() {
  const required = {
    SMOKE_BASE_URL_API: process.env.SMOKE_BASE_URL_API,
    SMOKE_BASE_URL_WEB: process.env.SMOKE_BASE_URL_WEB,
    SMOKE_USER_EMAIL: process.env.SMOKE_USER_EMAIL,
    SMOKE_USER_PASSWORD: process.env.SMOKE_USER_PASSWORD,
    SMOKE_ORG_ID: process.env.SMOKE_ORG_ID,
    SMOKE_CHECK_TOKEN: process.env.SMOKE_CHECK_TOKEN
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required smoke env vars: ${missing.join(', ')}`);
  }

  const apiBase = required.SMOKE_BASE_URL_API;
  const webBase = required.SMOKE_BASE_URL_WEB;
  const email = required.SMOKE_USER_EMAIL;
  const password = required.SMOKE_USER_PASSWORD;
  const organizationId = required.SMOKE_ORG_ID;
  const smokeToken = required.SMOKE_CHECK_TOKEN;

  const report = {
    task: 'RC-02',
    startedAt: nowIso(),
    finishedAt: '',
    durationMs: 0,
    gates: [],
    verdict: 'GO'
  };

  const started = process.hrtime.bigint();
  const signal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);

  const created = {
    userId: '',
    leadId: '',
    clientId: '',
    quoteId: '',
    bookingId: '',
    assetId: '',
    inventoryItemId: '',
    rentalOrderId: '',
    invoiceId: ''
  };

  let accessToken = '';
  const runId = String(Date.now());

  report.gates.push(
    await runCheck('api-health', async () => {
      const health = await checkJson(`${apiBase}/health`, { signal });
      if (!health.response.ok) {
        throw new Error(`API health failed (${health.response.status})`);
      }
    })
  );

  report.gates.push(
    await runCheck('web-reachable', async () => {
      const home = await fetch(`${webBase}/`, { signal });
      if (!home.ok) {
        throw new Error(`Web home failed (${home.status})`);
      }

      const dashboard = await fetch(`${webBase}/dashboard`, {
        signal,
        redirect: 'manual'
      });
      if (![200, 302, 307].includes(dashboard.status)) {
        throw new Error(`Web dashboard unexpected status ${dashboard.status}`);
      }
    })
  );

  report.gates.push(
    await runCheck('worker-heartbeat', async () => {
      const workers = await checkJson(`${apiBase}/health/workers`, {
        signal,
        headers: smokeHeaders(smokeToken)
      });
      if (!workers.response.ok) {
        throw new Error(`Worker heartbeat failed (${workers.response.status})`);
      }
      if (!Array.isArray(workers.body?.workers) || workers.body.workers.length < 1) {
        throw new Error('Worker heartbeat payload missing workers list');
      }
    })
  );

  report.gates.push(
    await runCheck('auth-login-profile', async () => {
      const login = await checkJson(`${apiBase}/auth/login`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!login.response.ok || !login.body?.accessToken) {
        throw new Error(`Auth login failed (${login.response.status})`);
      }
      accessToken = login.body.accessToken;

      const profile = await checkJson(`${apiBase}/auth/profile`, {
        signal,
        headers: authHeaders(accessToken)
      });
      if (!profile.response.ok || !profile.body?.id) {
        throw new Error(`Profile fetch failed (${profile.response.status})`);
      }
      created.userId = profile.body.id;
    })
  );

  report.gates.push(
    await runCheck('lead-create-convert', async () => {
      const lead = await checkJson(`${apiBase}/crm/leads`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify({
          organizationId,
          name: `smoke-lead-${runId}`,
          email: `smoke-${runId}@example.com`,
          source: `smoke-${runId}`
        })
      });
      if (!lead.response.ok || !lead.body?.id) {
        throw new Error(`Lead create failed (${lead.response.status})`);
      }
      created.leadId = lead.body.id;

      const converted = await checkJson(`${apiBase}/crm/leads/${created.leadId}/convert`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify({ organizationId })
      });
      if (!converted.response.ok || !converted.body?.client?.id) {
        throw new Error(`Lead convert failed (${converted.response.status})`);
      }
      created.clientId = converted.body.client.id;
    })
  );

  report.gates.push(
    await runCheck('quote-to-booking-draft', async () => {
      const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

      const quote = await checkJson(`${apiBase}/crm/quotes`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify({
          organizationId,
          clientId: created.clientId,
          title: `smoke-quote-${runId}`,
          startsAt,
          endsAt,
          items: [{ description: 'Smoke package', quantity: 1, unitPriceCents: 10000 }]
        })
      });

      if (!quote.response.ok || !quote.body?.id) {
        throw new Error(`Quote create failed (${quote.response.status})`);
      }
      created.quoteId = quote.body.id;

      const sent = await checkJson(
        `${apiBase}/crm/quotes/${created.quoteId}/status?organizationId=${encodeURIComponent(organizationId)}`,
        {
          method: 'PATCH',
          signal,
          headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
          body: JSON.stringify({ status: 'sent' })
        }
      );
      if (!sent.response.ok) {
        throw new Error(`Quote send failed (${sent.response.status})`);
      }

      const accepted = await checkJson(
        `${apiBase}/crm/quotes/${created.quoteId}/status?organizationId=${encodeURIComponent(organizationId)}`,
        {
          method: 'PATCH',
          signal,
          headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
          body: JSON.stringify({ status: 'accepted' })
        }
      );
      if (!accepted.response.ok || !accepted.body?.booking?.id) {
        throw new Error(`Quote accept failed (${accepted.response.status})`);
      }
      created.bookingId = accepted.body.booking.id;
    })
  );

  report.gates.push(
    await runCheck('rental-reservation', async () => {
      const asset = await checkJson(`${apiBase}/inventory/assets`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify({
          organizationId,
          name: `smoke-asset-${runId}`,
          category: 'camera'
        })
      });
      if (!asset.response.ok || !asset.body?.id) {
        throw new Error(`Asset create failed (${asset.response.status})`);
      }
      created.assetId = asset.body.id;

      const item = await checkJson(`${apiBase}/inventory/items`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify({
          organizationId,
          assetId: created.assetId,
          serialNumber: `smoke-serial-${runId}`,
          condition: 'good'
        })
      });
      if (!item.response.ok || !item.body?.id) {
        throw new Error(`Inventory item create failed (${item.response.status})`);
      }
      created.inventoryItemId = item.body.id;

      const rental = await checkJson(`${apiBase}/rentals`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify({
          organizationId,
          inventoryItemId: created.inventoryItemId,
          clientId: created.clientId,
          startsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          endsAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        })
      });
      if (!rental.response.ok || !rental.body?.id) {
        throw new Error(`Rental create failed (${rental.response.status})`);
      }
      created.rentalOrderId = rental.body.id;
    })
  );

  report.gates.push(
    await runCheck('invoice-draft', async () => {
      const invoice = await checkJson(`${apiBase}/billing/invoices`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify({
          organizationId,
          clientId: created.clientId,
          invoiceNumber: `SMOKE-${runId}`,
          subtotalCents: 10000,
          taxCents: 0,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
      });
      if (!invoice.response.ok || !invoice.body?.id) {
        throw new Error(`Invoice create failed (${invoice.response.status})`);
      }
      created.invoiceId = invoice.body.id;
    })
  );

  report.gates.push(
    await runCheck('queue-notification-consume', async () => {
      const queueSmoke = await checkJson(`${apiBase}/health/queue-smoke`, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...smokeHeaders(smokeToken)
        },
        body: JSON.stringify({ recipientUserId: created.userId })
      });
      if (!queueSmoke.response.ok || queueSmoke.body?.status !== 'processed') {
        throw new Error(`Queue smoke failed (${queueSmoke.response.status})`);
      }
    })
  );

  report.gates.push(
    await runCheck('storage-presign', async () => {
      const upload = await checkJson(`${apiBase}/storage/presign-upload`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify({
          organizationId,
          objectKey: `smoke/${runId}.txt`,
          contentType: 'text/plain',
          contentLengthBytes: 32
        })
      });
      if (!upload.response.ok || typeof upload.body?.url !== 'string') {
        throw new Error(`Presign upload failed (${upload.response.status})`);
      }
      if (typeof upload.body?.expiresAt !== 'string') {
        throw new Error('Presign response missing expiresAt');
      }
    })
  );

  report.gates.push(
    await runCheck('cleanup', async () => {
      const cleanup = await checkJson(`${apiBase}/health/smoke-cleanup`, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...smokeHeaders(smokeToken)
        },
        body: JSON.stringify({
          organizationId,
          leadId: created.leadId,
          clientId: created.clientId,
          quoteId: created.quoteId,
          bookingId: created.bookingId,
          assetId: created.assetId,
          inventoryItemId: created.inventoryItemId,
          rentalOrderId: created.rentalOrderId,
          invoiceId: created.invoiceId
        })
      });

      if (!cleanup.response.ok || cleanup.body?.status !== 'cleaned') {
        throw new Error(`Cleanup failed (${cleanup.response.status})`);
      }
    })
  );

  if (durationMs(started) > DEFAULT_TIMEOUT_MS) {
    report.gates.push({
      name: 'timeout-budget',
      status: 'FAIL',
      durationMs: 0,
      failures: [`Smoke execution exceeded budget ${DEFAULT_TIMEOUT_MS}ms`]
    });
  }

  report.verdict = report.gates.some((gate) => gate.status === 'FAIL') ? 'NO-GO' : 'GO';
  report.finishedAt = nowIso();
  report.durationMs = durationMs(started);

  await writeJson(ARTIFACT_JSON, report);
  await writeText(ARTIFACT_MD, toMarkdownReport('Post-Deploy Smoke Test', report));

  if (report.verdict === 'NO-GO') {
    process.exit(1);
  }
}

void main().catch(async (error) => {
  const report = {
    task: 'RC-02',
    startedAt: nowIso(),
    finishedAt: nowIso(),
    durationMs: 0,
    gates: [
      {
        name: 'smoke-bootstrap',
        status: 'FAIL',
        durationMs: 0,
        failures: [error instanceof Error ? error.message : 'Unknown error']
      }
    ],
    verdict: 'NO-GO'
  };

  await writeJson(ARTIFACT_JSON, report);
  await writeText(ARTIFACT_MD, toMarkdownReport('Post-Deploy Smoke Test', report));
  process.exit(1);
});
