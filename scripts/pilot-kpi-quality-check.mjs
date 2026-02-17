import { nowIso, writeJson, writeText } from './_reporting.mjs';

const ARTIFACT_JSON = 'artifacts/pilot-kpi/quality.json';
const ARTIFACT_MD = 'artifacts/pilot-kpi/quality.md';

async function main() {
  const apiBase = process.env.PILOT_KPI_API_BASE_URL;
  const accessToken = process.env.PILOT_KPI_ACCESS_TOKEN;
  const organizationId = process.env.PILOT_KPI_ORG_ID;

  if (!apiBase || !accessToken) {
    throw new Error('PILOT_KPI_API_BASE_URL and PILOT_KPI_ACCESS_TOKEN are required');
  }

  const query = new URLSearchParams();
  if (organizationId) {
    query.set('organizationId', organizationId);
  }
  query.set('days', process.env.PILOT_KPI_DAYS ?? '7');

  const response = await fetch(`${apiBase}/analytics/pilot-kpis/quality?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const body = await response.json().catch(() => ({}));
  const failed =
    !response.ok || Number(body?.missingRequiredFields ?? 0) > 0 || Number(body?.duplicateIdempotencyKeys ?? 0) > 0;

  const report = {
    task: 'RC-05',
    startedAt: nowIso(),
    finishedAt: nowIso(),
    durationMs: 0,
    gates: [
      {
        name: 'pilot-kpi-quality',
        status: failed ? 'FAIL' : 'PASS',
        failures: failed ? [JSON.stringify(body)] : [],
        durationMs: 0
      }
    ],
    verdict: failed ? 'NO-GO' : 'GO',
    data: body
  };

  await writeJson(ARTIFACT_JSON, report);
  await writeText(
    ARTIFACT_MD,
    `# Pilot KPI Quality Check\n\n- Verdict: **${report.verdict}**\n- Missing required fields: ${body?.missingRequiredFields ?? 'n/a'}\n- Duplicate idempotency keys: ${body?.duplicateIdempotencyKeys ?? 'n/a'}\n`
  );

  if (failed) {
    process.exit(1);
  }
}

void main().catch(async (error) => {
  const report = {
    task: 'RC-05',
    startedAt: nowIso(),
    finishedAt: nowIso(),
    durationMs: 0,
    gates: [
      {
        name: 'pilot-kpi-quality',
        status: 'FAIL',
        failures: [error instanceof Error ? error.message : 'Unknown error'],
        durationMs: 0
      }
    ],
    verdict: 'NO-GO'
  };

  await writeJson(ARTIFACT_JSON, report);
  await writeText(ARTIFACT_MD, `# Pilot KPI Quality Check\n\n- Verdict: **NO-GO**\n`);
  process.exit(1);
});
