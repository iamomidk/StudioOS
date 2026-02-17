const DB_BUCKETS_MS = [5, 20, 50, 100, 250, 500, 1000, 2000];

interface SlowQuerySample {
  durationMs: number;
  queryFingerprint: string;
  capturedAt: string;
}

class DbProfileStore {
  private count = 0;
  private sumMs = 0;
  private readonly buckets = Array.from({ length: DB_BUCKETS_MS.length + 1 }, () => 0);
  private slowQueryCount = 0;
  private slowQueryThresholdMs = Number.parseInt(process.env.PERF_SLOW_QUERY_MS ?? '200', 10);
  private readonly slowSamples: SlowQuerySample[] = [];

  recordQuery(durationMs: number, query: string): void {
    const bounded = Number.isFinite(durationMs) ? Math.max(durationMs, 0) : 0;
    this.count += 1;
    this.sumMs += bounded;

    const idx = DB_BUCKETS_MS.findIndex((bucket) => bounded <= bucket);
    if (idx === -1) {
      const last = this.buckets.length - 1;
      this.buckets[last] = (this.buckets[last] ?? 0) + 1;
    } else {
      this.buckets[idx] = (this.buckets[idx] ?? 0) + 1;
    }

    if (bounded >= this.slowQueryThresholdMs) {
      this.slowQueryCount += 1;
      const fingerprint = query
        .replace(/\s+/g, ' ')
        .replace(/[0-9]+/g, '?')
        .trim()
        .slice(0, 120);

      this.slowSamples.push({
        durationMs: bounded,
        queryFingerprint: fingerprint,
        capturedAt: new Date().toISOString()
      });

      this.slowSamples.sort((a, b) => b.durationMs - a.durationMs);
      if (this.slowSamples.length > 5) {
        this.slowSamples.length = 5;
      }
    }
  }

  snapshot() {
    return {
      count: this.count,
      sumMs: this.sumMs,
      bucketsMs: DB_BUCKETS_MS,
      buckets: [...this.buckets],
      slowQueryCount: this.slowQueryCount,
      slowQueryThresholdMs: this.slowQueryThresholdMs,
      slowSamples: [...this.slowSamples]
    };
  }
}

export const dbProfileStore = new DbProfileStore();
