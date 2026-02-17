import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

void test('perf runner writes report artifacts in simulated mode', async () => {
  await rm('artifacts/perf', { recursive: true, force: true });

  execFileSync('node', ['scripts/perf-runner.mjs'], {
    env: {
      ...process.env,
      PERF_USE_SIMULATED: 'true',
      PERF_ENV: 'local',
      PERF_BASE_URL: 'http://localhost:3000',
      PERF_SCENARIOS: 'smoke,baseline',
      PERF_SEED: '123'
    },
    stdio: 'pipe'
  });

  assert.equal(existsSync('artifacts/perf/report.json'), true);
  assert.equal(existsSync('artifacts/perf/report.md'), true);

  const report = JSON.parse(readFileSync('artifacts/perf/report.json', 'utf8'));
  assert.equal(report.task, 'RC-26');
  assert.equal(typeof report.verdict, 'string');
  assert.equal(typeof report.scenarioResults.smoke.p95_ms, 'number');
});
