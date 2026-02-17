import { Injectable } from '@nestjs/common';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const LATENCY_BUCKETS_MS = [100, 250, 500, 900, 2000];

interface LatencyState {
  count: number;
  sumMs: number;
  buckets: number[];
}

interface QueueState {
  depth: number;
  lastEnqueuedAtMs: number | null;
  lastProcessedAtMs: number | null;
}

@Injectable()
export class MetricsService {
  private httpRequestsTotal = 0;
  private httpErrorsTotal = 0;
  private readonly readLatency: LatencyState = {
    count: 0,
    sumMs: 0,
    buckets: Array.from({ length: LATENCY_BUCKETS_MS.length + 1 }, () => 0)
  };
  private readonly writeLatency: LatencyState = {
    count: 0,
    sumMs: 0,
    buckets: Array.from({ length: LATENCY_BUCKETS_MS.length + 1 }, () => 0)
  };

  private webhookProcessedTotal = 0;
  private webhookFailedTotal = 0;

  private readonly queueState = new Map<string, QueueState>();
  private readonly workerSuccessTotal = new Map<string, number>();
  private readonly workerFailureTotal = new Map<string, number>();

  recordRequest(statusCode: number, durationMs = 0, method = 'GET'): void {
    this.httpRequestsTotal += 1;
    if (statusCode >= 400) {
      this.httpErrorsTotal += 1;
    }

    const state = READ_METHODS.has(method.toUpperCase()) ? this.readLatency : this.writeLatency;
    this.observeLatency(state, durationMs);
  }

  recordQueueEnqueued(queueName: string): void {
    const state = this.ensureQueueState(queueName);
    state.depth += 1;
    state.lastEnqueuedAtMs = Date.now();
  }

  recordQueueProcessed(queueName: string, success: boolean): void {
    const state = this.ensureQueueState(queueName);
    state.depth = Math.max(0, state.depth - 1);
    state.lastProcessedAtMs = Date.now();

    const worker = this.mapQueueToWorker(queueName);
    this.bumpWorkerCounter(worker, success);
  }

  recordWebhookProcessed(success: boolean): void {
    if (success) {
      this.webhookProcessedTotal += 1;
      return;
    }

    this.webhookFailedTotal += 1;
  }

  snapshot() {
    const queueDepth: Record<string, number> = {};
    const queueLagSeconds: Record<string, number> = {};

    for (const [queueName, state] of this.queueState.entries()) {
      queueDepth[queueName] = state.depth;
      if (state.lastEnqueuedAtMs === null) {
        queueLagSeconds[queueName] = 0;
      } else if (state.lastProcessedAtMs === null) {
        queueLagSeconds[queueName] = Math.max(
          0,
          Math.floor((Date.now() - state.lastEnqueuedAtMs) / 1000)
        );
      } else {
        queueLagSeconds[queueName] = Math.max(
          0,
          Math.floor((state.lastEnqueuedAtMs - state.lastProcessedAtMs) / 1000)
        );
      }
    }

    return {
      httpRequestsTotal: this.httpRequestsTotal,
      httpErrorsTotal: this.httpErrorsTotal,
      latencyBucketsMs: LATENCY_BUCKETS_MS,
      readLatency: this.readLatency,
      writeLatency: this.writeLatency,
      queueDepth,
      queueLagSeconds,
      webhookProcessedTotal: this.webhookProcessedTotal,
      webhookFailedTotal: this.webhookFailedTotal,
      workerSuccessTotal: Object.fromEntries(this.workerSuccessTotal),
      workerFailureTotal: Object.fromEntries(this.workerFailureTotal)
    };
  }

  private observeLatency(state: LatencyState, durationMs: number): void {
    const bounded = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
    state.count += 1;
    state.sumMs += bounded;

    const idx = LATENCY_BUCKETS_MS.findIndex((bucket) => bounded <= bucket);
    if (idx === -1) {
      const lastIndex = state.buckets.length - 1;
      state.buckets[lastIndex] = (state.buckets[lastIndex] ?? 0) + 1;
      return;
    }

    state.buckets[idx] = (state.buckets[idx] ?? 0) + 1;
  }

  private ensureQueueState(queueName: string): QueueState {
    const existing = this.queueState.get(queueName);
    if (existing) {
      return existing;
    }

    const created: QueueState = {
      depth: 0,
      lastEnqueuedAtMs: null,
      lastProcessedAtMs: null
    };
    this.queueState.set(queueName, created);
    return created;
  }

  private mapQueueToWorker(queueName: string): string {
    switch (queueName) {
      case 'notifications':
      case 'notifications-dead-letter':
        return 'notifications';
      case 'invoice-reminders':
        return 'invoice-reminders';
      case 'media-jobs':
        return 'media';
      default:
        return 'unknown';
    }
  }

  private bumpWorkerCounter(workerName: string, success: boolean): void {
    const map = success ? this.workerSuccessTotal : this.workerFailureTotal;
    map.set(workerName, (map.get(workerName) ?? 0) + 1);
  }
}
