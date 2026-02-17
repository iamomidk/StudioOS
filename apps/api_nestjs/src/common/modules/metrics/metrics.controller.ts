import { Controller, Get, Header } from '@nestjs/common';

import { MetricsService } from './metrics.service.js';

function sanitizeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderLatencyMetrics(
  metricPrefix: string,
  state: { count: number; sumMs: number; buckets: number[] },
  boundariesMs: number[]
): string[] {
  const lines: string[] = [];

  lines.push(`# HELP ${metricPrefix}_ms API latency distribution in milliseconds.`);
  lines.push(`# TYPE ${metricPrefix}_ms histogram`);

  let cumulative = 0;
  for (let index = 0; index < boundariesMs.length; index += 1) {
    cumulative += state.buckets[index] ?? 0;
    lines.push(`${metricPrefix}_ms_bucket{le="${boundariesMs[index]}"} ${cumulative}`);
  }

  cumulative += state.buckets[boundariesMs.length] ?? 0;
  lines.push(`${metricPrefix}_ms_bucket{le="+Inf"} ${cumulative}`);
  lines.push(`${metricPrefix}_ms_sum ${state.sumMs}`);
  lines.push(`${metricPrefix}_ms_count ${state.count}`);

  return lines;
}

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  getMetrics(): string {
    const snapshot = this.metrics.snapshot();

    const lines: string[] = [
      '# HELP studioos_http_requests_total Total HTTP requests processed.',
      '# TYPE studioos_http_requests_total counter',
      `studioos_http_requests_total ${snapshot.httpRequestsTotal}`,
      '# HELP studioos_http_errors_total Total HTTP requests with status >= 400.',
      '# TYPE studioos_http_errors_total counter',
      `studioos_http_errors_total ${snapshot.httpErrorsTotal}`,
      ...renderLatencyMetrics(
        'studioos_api_read_latency',
        snapshot.readLatency,
        snapshot.latencyBucketsMs
      ),
      ...renderLatencyMetrics(
        'studioos_api_write_latency',
        snapshot.writeLatency,
        snapshot.latencyBucketsMs
      ),
      '# HELP studioos_webhook_processed_total Total successfully processed payment webhooks.',
      '# TYPE studioos_webhook_processed_total counter',
      `studioos_webhook_processed_total ${snapshot.webhookProcessedTotal}`,
      '# HELP studioos_webhook_failed_total Total failed payment webhook attempts.',
      '# TYPE studioos_webhook_failed_total counter',
      `studioos_webhook_failed_total ${snapshot.webhookFailedTotal}`,
      '# HELP studioos_queue_depth Current in-memory estimate of queue depth by queue.',
      '# TYPE studioos_queue_depth gauge'
    ];

    for (const [queueName, depth] of Object.entries(snapshot.queueDepth)) {
      lines.push(`studioos_queue_depth{queue="${sanitizeLabel(queueName)}"} ${depth}`);
    }

    lines.push('# HELP studioos_queue_lag_seconds Queue lag estimate by queue in seconds.');
    lines.push('# TYPE studioos_queue_lag_seconds gauge');
    for (const [queueName, lag] of Object.entries(snapshot.queueLagSeconds)) {
      lines.push(`studioos_queue_lag_seconds{queue="${sanitizeLabel(queueName)}"} ${lag}`);
    }

    lines.push('# HELP studioos_worker_jobs_total Total worker jobs handled by outcome.');
    lines.push('# TYPE studioos_worker_jobs_total counter');

    for (const [worker, total] of Object.entries(snapshot.workerSuccessTotal)) {
      lines.push(
        `studioos_worker_jobs_total{worker="${sanitizeLabel(worker)}",status="success"} ${total}`
      );
    }
    for (const [worker, total] of Object.entries(snapshot.workerFailureTotal)) {
      lines.push(
        `studioos_worker_jobs_total{worker="${sanitizeLabel(worker)}",status="failure"} ${total}`
      );
    }

    return lines.join('\n');
  }
}
