import {
  durationMs,
  nowIso,
  toMarkdownReport,
  writeJson,
  writeText
} from './_reporting.mjs';

const ARTIFACT_JSON = 'artifacts/launch-health/summary.json';
const ARTIFACT_MD = 'artifacts/launch-health/summary.md';

function parsePrometheusMetrics(text) {
  const values = new Map();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const [metric, rawValue] = trimmed.split(/\s+/, 2);
    if (!metric || !rawValue) {
      continue;
    }
    values.set(metric, Number(rawValue));
  }
  return values;
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function main() {
  const apiBaseUrl = process.env.LAUNCH_BASE_URL_API;
  const launchAuthToken = process.env.LAUNCH_AUTH_TOKEN;

  if (!apiBaseUrl) {
    throw new Error('Missing required env var: LAUNCH_BASE_URL_API');
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

  const healthStarted = process.hrtime.bigint();
  const health = await getJson(`${apiBaseUrl}/health`);
  report.gates.push({
    name: 'api-health',
    status: health.response.ok && health.body?.status === 'ok' ? 'PASS' : 'FAIL',
    durationMs: durationMs(healthStarted),
    failures: health.response.ok ? [] : [`/health returned ${health.response.status}`]
  });

  const metricsStarted = process.hrtime.bigint();
  const metricsResponse = await fetch(`${apiBaseUrl}/metrics`);
  const metricsBody = await metricsResponse.text();
  const metrics = parsePrometheusMetrics(metricsBody);
  report.gates.push({
    name: 'metrics-endpoint',
    status: metricsResponse.ok ? 'PASS' : 'FAIL',
    durationMs: durationMs(metricsStarted),
    failures: metricsResponse.ok ? [] : [`/metrics returned ${metricsResponse.status}`]
  });

  const launchHeaders =
    launchAuthToken && launchAuthToken.length > 0
      ? { Authorization: `Bearer ${launchAuthToken}` }
      : undefined;
  const launchStarted = process.hrtime.bigint();
  const launchHealth = await getJson(`${apiBaseUrl}/launch/health`, {
    headers: launchHeaders
  });
  report.gates.push({
    name: 'launch-dashboard',
    status: launchHealth.response.ok ? 'PASS' : 'FAIL',
    durationMs: durationMs(launchStarted),
    failures: launchHealth.response.ok
      ? []
      : [
          launchAuthToken
            ? `/launch/health returned ${launchHealth.response.status}`
            : 'LAUNCH_AUTH_TOKEN not set or /launch/health request failed'
        ]
  });

  const requestTotal = metrics.get('studioos_http_requests_total') ?? 0;
  const errorTotal = metrics.get('studioos_http_errors_total') ?? 0;
  const webhookProcessed = metrics.get('studioos_webhook_processed_total') ?? 0;
  const webhookFailed = metrics.get('studioos_webhook_failed_total') ?? 0;
  const errorRate = requestTotal > 0 ? errorTotal / requestTotal : 0;
  const webhookFailureRate =
    webhookProcessed + webhookFailed > 0 ? webhookFailed / (webhookProcessed + webhookFailed) : 0;

  report.finishedAt = nowIso();
  report.durationMs = durationMs(started);
  report.verdict = report.gates.some((gate) => gate.status === 'FAIL') ? 'NO-GO' : 'GO';

  const payload = {
    ...report,
    summary: {
      requestTotal,
      errorTotal,
      errorRate,
      webhookProcessed,
      webhookFailed,
      webhookFailureRate,
      launchHealth: launchHealth.body
    }
  };

  await writeJson(ARTIFACT_JSON, payload);
  await writeText(ARTIFACT_MD, toMarkdownReport('Launch Health', report));

  if (report.verdict === 'NO-GO') {
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
        name: 'launch-health-bootstrap',
        status: 'FAIL',
        durationMs: 0,
        failures: [error instanceof Error ? error.message : 'Unknown error']
      }
    ],
    verdict: 'NO-GO'
  };
  await writeJson(ARTIFACT_JSON, report);
  await writeText(ARTIFACT_MD, toMarkdownReport('Launch Health', report));
  process.exit(1);
});
