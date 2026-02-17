import { spawn } from 'node:child_process';

import {
  durationMs,
  extractFailures,
  nowIso,
  toMarkdownReport,
  writeJson,
  writeText
} from './_reporting.mjs';

const ARTIFACT_JSON = 'artifacts/rc-audit/summary.json';
const ARTIFACT_MD = 'artifacts/rc-audit/summary.md';

function runCommand(command, args, env = process.env) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const child = spawn(command, args, { env, shell: false });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      resolve({
        code: 1,
        stdout,
        stderr,
        output: `${stdout}\n${stderr}\n${error.message}`.trim(),
        durationMs: durationMs(started)
      });
    });
    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
        output: `${stdout}\n${stderr}`.trim(),
        durationMs: durationMs(started)
      });
    });
  });
}

function parseAuditVulnerabilities(output) {
  try {
    const parsed = JSON.parse(output);
    return parsed?.metadata?.vulnerabilities ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const report = {
    task: 'RC-01',
    startedAt: nowIso(),
    finishedAt: '',
    durationMs: 0,
    gates: [],
    verdict: 'GO'
  };

  const started = process.hrtime.bigint();
  const gates = [
    { name: 'lint', command: 'pnpm', args: ['lint:all'] },
    { name: 'typecheck', command: 'pnpm', args: ['typecheck:all'] },
    { name: 'tests', command: 'pnpm', args: ['test'] },
    {
      name: 'critical-e2e',
      command: 'pnpm',
      args: ['--filter', '@studioos/apps-api_nestjs', 'test']
    },
    { name: 'vulnerability-scan', command: 'pnpm', args: ['audit', '--json'] },
    { name: 'openapi-drift', command: 'pnpm', args: ['openapi:drift-check'] },
    {
      name: 'db-migration-sanity',
      command: 'pnpm',
      args: ['--filter', '@studioos/apps-api_nestjs', 'prisma:migrate:verify']
    }
  ];

  let blockingFailure = false;

  for (const gate of gates) {
    if (blockingFailure) {
      report.gates.push({
        name: gate.name,
        status: 'SKIPPED',
        durationMs: 0,
        failures: ['Skipped due to previous blocking failure']
      });
      continue;
    }

    const result = await runCommand(gate.command, gate.args);
    const failures = extractFailures(result.output);
    let status = result.code === 0 ? 'PASS' : 'FAIL';

    if (gate.name === 'vulnerability-scan') {
      const counts = parseAuditVulnerabilities(result.output);
      if (!counts) {
        status = 'FAIL';
        failures.push('Unable to parse vulnerability scan output');
      } else {
        const highCritical = Number(counts.high ?? 0) + Number(counts.critical ?? 0);
        const medium = Number(counts.moderate ?? counts.medium ?? 0);
        if (highCritical > 0) {
          status = 'FAIL';
          failures.push(`High/Critical vulnerabilities detected: ${highCritical}`);
        } else if (medium > 0) {
          failures.push(`Medium vulnerabilities (warning): ${medium}`);
          status = 'PASS';
        } else {
          status = 'PASS';
        }
      }
    }

    report.gates.push({
      name: gate.name,
      status,
      durationMs: result.durationMs,
      failures
    });

    if (status === 'FAIL') {
      blockingFailure = true;
    }
  }

  report.verdict = report.gates.some((gate) => gate.status === 'FAIL') ? 'NO-GO' : 'GO';
  report.finishedAt = nowIso();
  report.durationMs = durationMs(started);

  await writeJson(ARTIFACT_JSON, report);
  await writeText(ARTIFACT_MD, toMarkdownReport('Release Readiness Audit', report));

  if (report.verdict === 'NO-GO') {
    process.exit(1);
  }
}

void main().catch(async (error) => {
  const failureReport = {
    task: 'RC-01',
    startedAt: nowIso(),
    finishedAt: nowIso(),
    durationMs: 0,
    gates: [
      {
        name: 'rc-audit-bootstrap',
        status: 'FAIL',
        durationMs: 0,
        failures: [error instanceof Error ? error.message : 'Unknown error']
      }
    ],
    verdict: 'NO-GO'
  };
  await writeJson(ARTIFACT_JSON, failureReport);
  await writeText(ARTIFACT_MD, toMarkdownReport('Release Readiness Audit', failureReport));
  process.exit(1);
});
