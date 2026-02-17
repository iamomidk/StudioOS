import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function ensureDirFor(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function writeJson(filePath, value) {
  await ensureDirFor(filePath);
  await writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export async function writeText(filePath, value) {
  await ensureDirFor(filePath);
  await writeFile(filePath, value, 'utf8');
}

export function nowIso() {
  return new Date().toISOString();
}

export function durationMs(startHr) {
  return Number((process.hrtime.bigint() - startHr) / BigInt(1e6));
}

export function extractFailures(output, limit = 20) {
  const patterns = [/^FAIL\b/i, /^not ok\b/i, /\berror\b/i, /AssertionError/, /Command failed/i];
  const ignores = [/^\s*✔/, /\bfail\s+0\b/i, /\bsuccess\b/i, /All matched files use Prettier/i];

  const failures = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (ignores.some((pattern) => pattern.test(trimmed))) {
      continue;
    }
    if (patterns.some((pattern) => pattern.test(trimmed))) {
      failures.push(trimmed);
      if (failures.length >= limit) {
        break;
      }
    }
  }
  return [...new Set(failures)];
}

export function toMarkdownReport(title, report) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`- Task: \`${report.task}\``);
  lines.push(`- Started: \`${report.startedAt}\``);
  lines.push(`- Finished: \`${report.finishedAt}\``);
  lines.push(`- Duration: \`${report.durationMs}ms\``);
  lines.push(`- Verdict: **${report.verdict}**`);
  lines.push('');
  lines.push('| Gate | Status | Duration (ms) | Failures |');
  lines.push('| --- | --- | ---: | --- |');
  for (const gate of report.gates) {
    lines.push(
      `| ${gate.name} | ${gate.status} | ${gate.durationMs} | ${
        gate.failures.length > 0 ? gate.failures.join('<br/>') : '-'
      } |`
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}
