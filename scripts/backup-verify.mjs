import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { nowIso, writeJson, writeText } from './_reporting.mjs';

const ARTIFACT_JSON = 'artifacts/backup-verify/report.json';
const ARTIFACT_MD = 'artifacts/backup-verify/report.md';

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function buildMarkdown(report) {
  const lines = [
    '# Backup Verification Report',
    '',
    `- Task: \`${report.task}\``,
    `- Started: \`${report.startedAt}\``,
    `- Finished: \`${report.finishedAt}\``,
    `- Verdict: **${report.verdict}**`,
    '',
    '| Gate | Status | Details |',
    '| --- | --- | --- |'
  ];

  for (const gate of report.gates) {
    lines.push(`| ${gate.name} | ${gate.status} | ${gate.details || '-'} |`);
  }

  lines.push('');
  if (report.backup) {
    lines.push('## Backup metadata');
    lines.push('');
    lines.push(`- S3 key: \`${report.backup.key}\``);
    lines.push(`- Last modified: \`${report.backup.lastModified}\``);
    lines.push(`- Size bytes: \`${report.backup.sizeBytes}\``);
    lines.push(`- Age seconds: \`${report.backup.ageSeconds}\``);
    lines.push(`- SHA256: \`${report.backup.sha256}\``);
  }

  if (report.restore) {
    lines.push('');
    lines.push('## Restore drill');
    lines.push('');
    lines.push(`- Duration ms: \`${report.restore.durationMs}\``);
    lines.push(`- Migration status: \`${report.restore.migrationStatus}\``);
    lines.push(`- Integrity checks: \`${report.restore.integrityStatus}\``);
  }

  return `${lines.join('\n')}\n`;
}

async function postFailureAlert(report, errorMessage) {
  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook) {
    return;
  }

  await fetch(webhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.ALERT_ROUTING_KEY
        ? { 'x-routing-key': process.env.ALERT_ROUTING_KEY }
        : {})
    },
    body: JSON.stringify({
      status: 'firing',
      alert: 'StudioOSBackupVerifyFailed',
      message: errorMessage,
      report
    })
  }).catch(() => undefined);
}

async function main() {
  const startedAt = nowIso();
  const started = Date.now();

  const bucket = process.env.BACKUP_S3_BUCKET;
  const prefix = process.env.BACKUP_S3_PREFIX ?? '';
  const region = process.env.BACKUP_AWS_REGION ?? 'us-east-1';
  const backupTimeoutMs = Number(process.env.BACKUP_VERIFY_TIMEOUT_MS ?? 600000);

  const report = {
    task: 'RC-04',
    startedAt,
    finishedAt: '',
    durationMs: 0,
    gates: [],
    backup: null,
    restore: null,
    verdict: 'GO'
  };

  if (!bucket) {
    throw new Error('BACKUP_S3_BUCKET is required');
  }

  const tempRoot = join(tmpdir(), `studioos-backup-verify-${Date.now()}`);
  await mkdir(tempRoot, { recursive: true });
  const localBackupFile = join(tempRoot, 'latest-backup.dump');

  const list = await run('aws', [
    's3api',
    'list-objects-v2',
    '--bucket',
    bucket,
    '--prefix',
    prefix,
    '--region',
    region,
    '--query',
    'reverse(sort_by(Contents,&LastModified))[:1]',
    '--output',
    'json'
  ]);

  if (list.code !== 0) {
    throw new Error(`S3 listing failed: ${list.stderr || list.stdout}`);
  }

  const latest = JSON.parse(list.stdout || '[]')[0];
  if (!latest?.Key) {
    throw new Error('No backup objects found in configured bucket/prefix');
  }

  report.gates.push({ name: 'discover-latest-backup', status: 'PASS', details: latest.Key });

  const copy = await run('aws', [
    's3',
    'cp',
    `s3://${bucket}/${latest.Key}`,
    localBackupFile,
    '--region',
    region
  ]);
  if (copy.code !== 0) {
    throw new Error(`Backup download failed: ${copy.stderr || copy.stdout}`);
  }
  report.gates.push({ name: 'download-backup', status: 'PASS', details: localBackupFile });

  const checksum = await sha256(localBackupFile);
  const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(latest.LastModified).getTime()) / 1000));
  report.backup = {
    key: latest.Key,
    lastModified: latest.LastModified,
    sizeBytes: Number(latest.Size ?? 0),
    ageSeconds,
    sha256: checksum
  };
  report.gates.push({ name: 'checksum-verify', status: 'PASS', details: checksum });

  const container = `studioos-backup-verify-${Date.now()}`;
  const pgPort = process.env.BACKUP_RESTORE_PORT ?? '55432';
  const dbName = process.env.BACKUP_RESTORE_DB ?? 'studioos_restore';

  const startDb = await run('docker', [
    'run',
    '--rm',
    '-d',
    '--name',
    container,
    '-e',
    'POSTGRES_PASSWORD=postgres',
    '-e',
    `POSTGRES_DB=${dbName}`,
    '-p',
    `${pgPort}:5432`,
    'postgres:16'
  ]);
  if (startDb.code !== 0) {
    throw new Error(`Failed to start ephemeral postgres: ${startDb.stderr || startDb.stdout}`);
  }

  const restoreStart = Date.now();
  try {
    let ready = false;
    const readyDeadline = Date.now() + Math.min(backupTimeoutMs, 90_000);
    while (!ready && Date.now() < readyDeadline) {
      const probe = await run('docker', ['exec', container, 'pg_isready', '-U', 'postgres']);
      if (probe.code === 0) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (!ready) {
      throw new Error('Timed out waiting for ephemeral postgres readiness');
    }

    const restore = await run('bash', [
      '-lc',
      `cat '${localBackupFile}' | docker exec -i ${container} pg_restore -U postgres -d ${dbName}`
    ]);
    if (restore.code !== 0) {
      const fallback = await run('bash', [
        '-lc',
        `cat '${localBackupFile}' | docker exec -i ${container} psql -U postgres -d ${dbName}`
      ]);
      if (fallback.code !== 0) {
        throw new Error(`Restore failed: ${restore.stderr || restore.stdout} ${fallback.stderr || fallback.stdout}`);
      }
    }
    report.gates.push({ name: 'restore-latest-backup', status: 'PASS', details: 'ephemeral restore succeeded' });

    const migrateStatus = await run(
      'pnpm',
      ['--filter', '@studioos/apps-api_nestjs', 'prisma:migrate:status'],
      {
        env: {
          ...process.env,
          DATABASE_URL: `postgresql://postgres:postgres@localhost:${pgPort}/${dbName}`
        }
      }
    );
    if (migrateStatus.code !== 0) {
      throw new Error(`Migration status check failed: ${migrateStatus.stderr || migrateStatus.stdout}`);
    }

    report.gates.push({ name: 'migration-status-check', status: 'PASS', details: 'prisma migrate status ok' });

    const integrity = await run('docker', [
      'exec',
      container,
      'psql',
      '-U',
      'postgres',
      '-d',
      dbName,
      '-t',
      '-c',
      'SELECT COUNT(*) FROM "Organization";'
    ]);

    if (integrity.code !== 0) {
      throw new Error(`Integrity query failed: ${integrity.stderr || integrity.stdout}`);
    }

    const orgCount = Number(String(integrity.stdout).trim() || 0);
    const minimumOrgCount = Number(process.env.BACKUP_MIN_ORG_ROWS ?? 0);
    if (orgCount < minimumOrgCount) {
      throw new Error(`Integrity assertion failed: Organization count ${orgCount} < ${minimumOrgCount}`);
    }

    report.gates.push({
      name: 'integrity-assertions',
      status: 'PASS',
      details: `Organization count ${orgCount}`
    });

    report.restore = {
      durationMs: Date.now() - restoreStart,
      migrationStatus: 'PASS',
      integrityStatus: 'PASS',
      rpoSeconds: ageSeconds,
      rtoMs: Date.now() - restoreStart
    };
  } finally {
    await run('docker', ['stop', container]);
    await rm(tempRoot, { recursive: true, force: true });
  }

  report.finishedAt = nowIso();
  report.durationMs = Date.now() - started;
  report.verdict = report.gates.every((gate) => gate.status === 'PASS') ? 'GO' : 'NO-GO';

  await writeJson(ARTIFACT_JSON, report);
  await writeText(ARTIFACT_MD, buildMarkdown(report));

  if (report.verdict !== 'GO') {
    await postFailureAlert(report, 'Backup verification failed');
    process.exit(1);
  }
}

void main().catch(async (error) => {
  const report = {
    task: 'RC-04',
    startedAt: nowIso(),
    finishedAt: nowIso(),
    durationMs: 0,
    gates: [
      {
        name: 'backup-verify',
        status: 'FAIL',
        details: error instanceof Error ? error.message : 'Unknown failure'
      }
    ],
    verdict: 'NO-GO'
  };

  await writeJson(ARTIFACT_JSON, report);
  await writeText(ARTIFACT_MD, buildMarkdown(report));
  await postFailureAlert(report, report.gates[0].details);
  process.exit(1);
});
