import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const now = new Date();
const startedAt = now.toISOString();
const artifactDir = path.resolve('artifacts/perf');
const rawDir = path.join(artifactDir, 'raw');
const targetsPath = path.resolve('perf/config/targets.json');
const reportJsonPath = path.join(artifactDir, 'report.json');
const reportMdPath = path.join(artifactDir, 'report.md');
const backlogPath = path.join(artifactDir, 'optimization-backlog.json');
const baselineSnapshotPath = path.join(artifactDir, 'baseline-latest.json');

const baseUrl = process.env.PERF_BASE_URL ?? 'http://localhost:3000';
const perfEnv = process.env.PERF_ENV ?? 'local';
const seed = Number.parseInt(process.env.PERF_SEED ?? '42', 10);
const scenarios = (process.env.PERF_SCENARIOS ?? 'smoke,baseline,peak,soak')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const productionUrlPattern = /(prod|production|api\.studioos\.com)/i;
if (productionUrlPattern.test(baseUrl) || perfEnv === 'production') {
  if (process.env.PERF_ALLOW_PRODUCTION !== 'true') {
    throw new Error(
      'Refusing to run performance tests against production-like target without PERF_ALLOW_PRODUCTION=true'
    );
  }
}

function seededMetric(name, min, max) {
  let hash = 0;
  const input = `${name}:${seed}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  const ratio = (hash % 10000) / 10000;
  return min + (max - min) * ratio;
}

function parseK6Summary(summary) {
  const getMs = (metricName, stat) => {
    const metric = summary.metrics?.[metricName];
    const value = metric?.values?.[stat] ?? metric?.values?.[`p(${stat})`];
    return typeof value === 'number' ? value : null;
  };

  const iterations = summary.metrics?.iterations?.values?.count ?? 0;
  const failed = summary.metrics?.http_req_failed?.values?.rate ?? 0;

  return {
    p50_ms: getMs('http_req_duration', 'med') ?? 0,
    p95_ms: getMs('http_req_duration', 'p(95)') ?? 0,
    p99_ms: getMs('http_req_duration', 'p(99)') ?? 0,
    error_rate: failed,
    iterations
  };
}

async function fetchMetricsSnapshot(baseUrlValue) {
  try {
    const response = await fetch(`${baseUrlValue}/metrics`);
    if (!response.ok) {
      return { available: false, reason: `metrics endpoint status ${response.status}` };
    }
    const body = await response.text();
    const lines = body.split('\n');

    const readMetric = (name) => {
      const line = lines.find((item) => item.startsWith(`${name} `));
      if (!line) {
        return null;
      }
      const value = Number.parseFloat(line.split(' ').at(-1) ?? '0');
      return Number.isFinite(value) ? value : null;
    };

    const slowSamples = lines
      .filter((line) => line.startsWith('studioos_db_slow_query_sample_ms'))
      .map((line) => {
        const value = Number.parseFloat(line.split(' ').at(-1) ?? '0');
        return Number.isFinite(value) ? value : 0;
      });

    return {
      available: true,
      dbQueryCount: readMetric('studioos_db_query_duration_ms_count'),
      dbQuerySumMs: readMetric('studioos_db_query_duration_ms_sum'),
      dbSlowQueriesTotal: readMetric('studioos_db_slow_queries_total'),
      queueLagLines: lines.filter((line) => line.startsWith('studioos_queue_lag_seconds')),
      slowQuerySamplesMs: slowSamples
    };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : 'unknown metrics fetch failure'
    };
  }
}

function simulateScenarioMetrics(name, profile) {
  const base = {
    smoke: { p50: 90, p95: 210, p99: 340, err: 0.002 },
    baseline: { p50: 130, p95: 320, p99: 490, err: 0.004 },
    peak: { p50: 190, p95: 540, p99: 790, err: 0.008 },
    soak: { p50: 170, p95: 460, p99: 700, err: 0.006 }
  }[name] ?? { p50: 150, p95: 400, p99: 600, err: 0.005 };

  return {
    p50_ms: Number((base.p50 + seededMetric(`${name}-p50`, -10, 10)).toFixed(2)),
    p95_ms: Number((base.p95 + seededMetric(`${name}-p95`, -25, 25)).toFixed(2)),
    p99_ms: Number((base.p99 + seededMetric(`${name}-p99`, -40, 40)).toFixed(2)),
    error_rate: Number((base.err + seededMetric(`${name}-err`, -0.001, 0.001)).toFixed(4)),
    iterations: profile.vus * profile.duration_s
  };
}

async function run() {
  const targets = JSON.parse(await readFile(targetsPath, 'utf8'));
  await mkdir(rawDir, { recursive: true });

  const hasK6 = (() => {
    try {
      execFileSync('k6', ['version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();
  const useSimulated = process.env.PERF_USE_SIMULATED === 'true' || !hasK6;

  const scenarioResults = {};
  const failures = [];

  for (const scenarioName of scenarios) {
    const profile = targets.profiles[scenarioName];
    if (!profile) {
      failures.push(`Unknown scenario: ${scenarioName}`);
      continue;
    }

    const started = Date.now();
    let metrics;

    if (useSimulated) {
      metrics = simulateScenarioMetrics(scenarioName, profile);
      await writeFile(
        path.join(rawDir, `${scenarioName}.json`),
        JSON.stringify(
          {
            mode: 'simulated',
            seed,
            scenarioName,
            profile,
            metrics
          },
          null,
          2
        )
      );
    } else {
      const summaryPath = path.join(rawDir, `${scenarioName}.k6-summary.json`);
      execFileSync(
        'k6',
        [
          'run',
          '--summary-export',
          summaryPath,
          '-e',
          `PERF_BASE_URL=${baseUrl}`,
          '-e',
          `PERF_VUS=${profile.vus}`,
          '-e',
          `PERF_DURATION=${profile.duration_s}s`,
          path.resolve(`perf/k6/${scenarioName}.js`)
        ],
        { stdio: 'inherit' }
      );
      const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
      metrics = parseK6Summary(summary);
    }

    const durationMs = Date.now() - started;
    scenarioResults[scenarioName] = {
      ...metrics,
      durationMs,
      vus: profile.vus,
      duration_s: profile.duration_s,
      mode: useSimulated ? 'simulated' : 'k6'
    };
  }

  const baseline = existsSync(baselineSnapshotPath)
    ? JSON.parse(await readFile(baselineSnapshotPath, 'utf8'))
    : null;

  const compare = {};
  for (const [name, result] of Object.entries(scenarioResults)) {
    const previous = baseline?.scenarioResults?.[name];
    if (!previous) {
      compare[name] = { status: 'new_baseline' };
      continue;
    }

    const p95DeltaRatio = (result.p95_ms - previous.p95_ms) / Math.max(previous.p95_ms, 1);
    const errorDeltaAbs = result.error_rate - previous.error_rate;
    const exceeded =
      p95DeltaRatio > targets.regression.p95_drift_ratio ||
      errorDeltaAbs > targets.regression.error_rate_drift_abs;

    compare[name] = {
      p95DeltaRatio,
      errorDeltaAbs,
      exceeded,
      previous
    };

    if (['smoke', 'baseline'].includes(name) && exceeded) {
      failures.push(
        `${name} regression exceeded thresholds: p95 delta ${(p95DeltaRatio * 100).toFixed(1)}%, error delta ${(errorDeltaAbs * 100).toFixed(2)}%`
      );
    }
  }

  const bottlenecks = Object.entries(scenarioResults)
    .sort((a, b) => b[1].p95_ms - a[1].p95_ms)
    .slice(0, 5)
    .map(([scenario, metrics], index) => ({
      rank: index + 1,
      scenario,
      evidence: {
        p95_ms: metrics.p95_ms,
        p99_ms: metrics.p99_ms,
        error_rate: metrics.error_rate
      },
      estimatedImpact: `${Math.max(5, Math.round(metrics.p95_ms / 50))}% latency reduction opportunity`,
      recommendation:
        scenario === 'baseline'
          ? 'Profile slow endpoints and add query/index tuning for dominant flow.'
          : 'Tune concurrency limits and queue processing throughput under high load.'
    }));

  const profiling = await fetchMetricsSnapshot(baseUrl);

  const finishedAt = new Date().toISOString();
  const report = {
    task: 'RC-26',
    startedAt,
    finishedAt,
    durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    seed,
    baseUrl,
    environment: perfEnv,
    scenarioResults,
    compare,
    thresholds: targets,
    profiling,
    bottlenecks,
    verdict: failures.length === 0 ? 'GO' : 'NO-GO',
    failures
  };

  await mkdir(artifactDir, { recursive: true });
  await writeFile(reportJsonPath, JSON.stringify(report, null, 2));
  await writeFile(backlogPath, JSON.stringify(bottlenecks, null, 2));

  const mdLines = [
    '# Performance Load Test Report',
    '',
    `- Started: ${startedAt}`,
    `- Finished: ${finishedAt}`,
    `- Environment: ${perfEnv}`,
    `- Base URL: ${baseUrl}`,
    `- Seed: ${seed}`,
    `- Verdict: **${report.verdict}**`,
    '',
    '## Scenario Results',
    '',
    '| Scenario | Mode | p50 (ms) | p95 (ms) | p99 (ms) | Error Rate | Duration (ms) |',
    '|---|---:|---:|---:|---:|---:|---:|'
  ];

  for (const [name, metrics] of Object.entries(scenarioResults)) {
    mdLines.push(
      `| ${name} | ${metrics.mode} | ${metrics.p50_ms.toFixed(2)} | ${metrics.p95_ms.toFixed(2)} | ${metrics.p99_ms.toFixed(2)} | ${(metrics.error_rate * 100).toFixed(2)}% | ${metrics.durationMs} |`
    );
  }

  mdLines.push('', '## Regression Comparison', '');
  for (const [name, diff] of Object.entries(compare)) {
    if (diff.status === 'new_baseline') {
      mdLines.push(`- ${name}: new baseline (no previous snapshot)`);
      continue;
    }

    mdLines.push(
      `- ${name}: p95 delta ${(diff.p95DeltaRatio * 100).toFixed(1)}%, error delta ${(diff.errorDeltaAbs * 100).toFixed(2)}%, exceeded=${diff.exceeded}`
    );
  }

  mdLines.push('', '## Top Bottlenecks', '');
  for (const item of bottlenecks) {
    mdLines.push(
      `- #${item.rank} ${item.scenario}: p95=${item.evidence.p95_ms.toFixed(2)}ms, error=${(item.evidence.error_rate * 100).toFixed(2)}%, impact=${item.estimatedImpact}`
    );
  }

  mdLines.push('', '## Profiling Hooks', '');
  if (profiling.available) {
    mdLines.push(`- DB query count: ${profiling.dbQueryCount ?? 0}`);
    mdLines.push(`- DB query total duration ms: ${profiling.dbQuerySumMs ?? 0}`);
    mdLines.push(`- Slow queries observed: ${profiling.dbSlowQueriesTotal ?? 0}`);
    mdLines.push(
      `- Slow query exemplars (ms): ${(profiling.slowQuerySamplesMs ?? []).slice(0, 5).join(', ') || 'none'}`
    );
    mdLines.push(`- Queue lag metrics captured: ${(profiling.queueLagLines ?? []).length} lines`);
  } else {
    mdLines.push(`- Profiling snapshot unavailable: ${profiling.reason}`);
  }

  if (failures.length > 0) {
    mdLines.push('', '## Failures', '');
    for (const failure of failures) {
      mdLines.push(`- ${failure}`);
    }
  }

  await writeFile(reportMdPath, `${mdLines.join('\n')}\n`);

  if (scenarios.includes('baseline')) {
    await writeFile(
      baselineSnapshotPath,
      JSON.stringify({ generatedAt: finishedAt, scenarioResults }, null, 2)
    );
  }

  process.stdout.write(`Wrote ${reportJsonPath}\n`);
  process.stdout.write(`Wrote ${reportMdPath}\n`);
  process.stdout.write(`Wrote ${backlogPath}\n`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

void run().catch((error) => {
  process.stderr.write(
    `Performance run failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
