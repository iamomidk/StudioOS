import {
  durationMs,
  nowIso,
  toMarkdownReport,
  writeJson,
  writeText
} from './_reporting.mjs';

const ARTIFACT_24H_JSON = 'artifacts/launch-review/24h.json';
const ARTIFACT_24H_MD = 'artifacts/launch-review/24h.md';
const ARTIFACT_7D_JSON = 'artifacts/launch-review/7d.json';
const ARTIFACT_7D_MD = 'artifacts/launch-review/7d.md';

function getAuthHeaders() {
  const token = process.env.LAUNCH_AUTH_TOKEN;
  if (!token) {
    return undefined;
  }
  return { Authorization: `Bearer ${token}` };
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);
  return { response, body };
}

function summarizeKpi(payload) {
  if (!payload || !Array.isArray(payload.trend)) {
    return null;
  }

  const latest = payload.trend[payload.trend.length - 1];
  if (!latest) {
    return null;
  }

  return {
    leadToBookingRate: latest.leadToBookingConversionRate,
    bookingConflictRate: latest.bookingConflictRate,
    onTimeDeliveryRate: latest.onTimeDeliveryRate,
    rentalUtilizationRate: latest.rentalUtilizationRate,
    disputeRate: latest.disputeRate,
    dso: latest.daysSalesOutstanding
  };
}

function delta(current, baseline) {
  if (typeof current !== 'number' || typeof baseline !== 'number') {
    return null;
  }
  return Number((current - baseline).toFixed(4));
}

async function generateWindowReport(days) {
  const apiBaseUrl = process.env.LAUNCH_BASE_URL_API;
  if (!apiBaseUrl) {
    throw new Error('Missing required env var: LAUNCH_BASE_URL_API');
  }

  const organizationId = process.env.LAUNCH_ORGANIZATION_ID;
  const query = new URLSearchParams({ days: String(days) });
  if (organizationId) {
    query.set('organizationId', organizationId);
  }

  const report = {
    task: 'RC-10',
    startedAt: nowIso(),
    finishedAt: '',
    durationMs: 0,
    gates: [],
    verdict: 'GO'
  };
  const started = process.hrtime.bigint();

  const headers = getAuthHeaders();
  const healthStarted = process.hrtime.bigint();
  const launchHealth = await getJson(`${apiBaseUrl}/launch/health`, { headers });
  report.gates.push({
    name: 'launch-health',
    status: launchHealth.response.ok ? 'PASS' : 'FAIL',
    durationMs: durationMs(healthStarted),
    failures: launchHealth.response.ok ? [] : [`/launch/health returned ${launchHealth.response.status}`]
  });

  const kpiStarted = process.hrtime.bigint();
  const kpis = await getJson(`${apiBaseUrl}/analytics/pilot-kpis?${query.toString()}`, { headers });
  report.gates.push({
    name: 'pilot-kpis',
    status: kpis.response.ok ? 'PASS' : 'FAIL',
    durationMs: durationMs(kpiStarted),
    failures: kpis.response.ok ? [] : [`/analytics/pilot-kpis returned ${kpis.response.status}`]
  });

  report.finishedAt = nowIso();
  report.durationMs = durationMs(started);
  report.verdict = report.gates.some((gate) => gate.status === 'FAIL') ? 'NO-GO' : 'GO';

  return {
    ...report,
    windowDays: days,
    launchHealth: launchHealth.body,
    kpis: summarizeKpi(kpis.body)
  };
}

async function main() {
  const window24h = await generateWindowReport(1);
  const window7d = await generateWindowReport(7);

  const kpiDelta =
    window24h.kpis && window7d.kpis
      ? {
          leadToBookingRateDelta: delta(window24h.kpis.leadToBookingRate, window7d.kpis.leadToBookingRate),
          bookingConflictRateDelta: delta(window24h.kpis.bookingConflictRate, window7d.kpis.bookingConflictRate),
          onTimeDeliveryRateDelta: delta(window24h.kpis.onTimeDeliveryRate, window7d.kpis.onTimeDeliveryRate),
          rentalUtilizationRateDelta: delta(
            window24h.kpis.rentalUtilizationRate,
            window7d.kpis.rentalUtilizationRate
          ),
          disputeRateDelta: delta(window24h.kpis.disputeRate, window7d.kpis.disputeRate),
          dsoDelta: delta(window24h.kpis.dso, window7d.kpis.dso)
        }
      : null;

  await writeJson(ARTIFACT_24H_JSON, { ...window24h, comparisonTo7d: kpiDelta });
  await writeJson(ARTIFACT_7D_JSON, { ...window7d, comparisonTo24h: kpiDelta });
  await writeText(ARTIFACT_24H_MD, toMarkdownReport('Launch Review (24h)', window24h));
  await writeText(ARTIFACT_7D_MD, toMarkdownReport('Launch Review (7d)', window7d));

  if (window24h.verdict === 'NO-GO' || window7d.verdict === 'NO-GO') {
    process.exit(1);
  }
}

void main().catch(async (error) => {
  const report = {
    task: 'RC-10',
    startedAt: nowIso(),
    finishedAt: nowIso(),
    durationMs: 0,
    gates: [
      {
        name: 'post-launch-review-bootstrap',
        status: 'FAIL',
        durationMs: 0,
        failures: [error instanceof Error ? error.message : 'Unknown error']
      }
    ],
    verdict: 'NO-GO'
  };

  await writeJson(ARTIFACT_24H_JSON, report);
  await writeJson(ARTIFACT_7D_JSON, report);
  await writeText(ARTIFACT_24H_MD, toMarkdownReport('Launch Review (24h)', report));
  await writeText(ARTIFACT_7D_MD, toMarkdownReport('Launch Review (7d)', report));
  process.exit(1);
});
