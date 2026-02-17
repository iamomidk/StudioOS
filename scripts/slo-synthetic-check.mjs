import { writeJson, writeText, nowIso } from './_reporting.mjs';

const ARTIFACT_JSON = 'artifacts/slo/synthetic-check.json';
const ARTIFACT_MD = 'artifacts/slo/synthetic-check.md';

async function main() {
  const startedAt = nowIso();
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  const routingKey = process.env.ALERT_ROUTING_KEY;
  const allowInProd = process.env.SLO_SYNTHETIC_ALLOW_IN_PROD === 'true';

  if (!webhookUrl) {
    throw new Error('ALERT_WEBHOOK_URL is required for synthetic alert trigger checks');
  }

  if (process.env.NODE_ENV === 'production' && !allowInProd) {
    throw new Error('Synthetic alert checks are blocked in production unless SLO_SYNTHETIC_ALLOW_IN_PROD=true');
  }

  const payload = {
    receiver: 'studioos-synthetic',
    status: 'firing',
    alerts: [
      {
        status: 'firing',
        labels: {
          alertname: 'StudioOSSyntheticAlertPathTest',
          severity: 'test',
          service: 'observability'
        },
        annotations: {
          summary: 'Synthetic alert path verification',
          description: 'RC-03 synthetic alert trigger for routing validation.'
        },
        startsAt: new Date().toISOString()
      }
    ]
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(routingKey ? { 'x-routing-key': routingKey } : {})
    },
    body: JSON.stringify(payload)
  });

  const report = {
    task: 'RC-03',
    startedAt,
    finishedAt: nowIso(),
    durationMs: 0,
    gates: [
      {
        name: 'synthetic-alert-route',
        status: response.ok ? 'PASS' : 'FAIL',
        durationMs: 0,
        failures: response.ok ? [] : [`Webhook status ${response.status}`]
      }
    ],
    verdict: response.ok ? 'GO' : 'NO-GO'
  };

  await writeJson(ARTIFACT_JSON, report);
  await writeText(
    ARTIFACT_MD,
    `# SLO Synthetic Alert Check\n\n- Status: **${report.verdict}**\n- Webhook status: ${response.status}\n`
  );

  if (!response.ok) {
    process.exit(1);
  }
}

void main().catch(async (error) => {
  const report = {
    task: 'RC-03',
    startedAt: nowIso(),
    finishedAt: nowIso(),
    durationMs: 0,
    gates: [
      {
        name: 'synthetic-alert-route',
        status: 'FAIL',
        durationMs: 0,
        failures: [error instanceof Error ? error.message : 'Unknown error']
      }
    ],
    verdict: 'NO-GO'
  };

  await writeJson(ARTIFACT_JSON, report);
  await writeText(
    ARTIFACT_MD,
    `# SLO Synthetic Alert Check\n\n- Status: **NO-GO**\n- Failure: ${report.gates[0].failures[0]}\n`
  );
  process.exit(1);
});
