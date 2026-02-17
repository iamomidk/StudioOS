import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import test from 'node:test';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { MetricsModule } from '../src/common/modules/metrics/metrics.module.js';
import { MetricsService } from '../src/common/modules/metrics/metrics.service.js';

let app: INestApplication;
let metricsService: MetricsService;

test.before(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [MetricsModule]
  }).compile();

  app = moduleRef.createNestApplication();
  metricsService = app.get(MetricsService);
  metricsService.recordRequest(200, 120, 'GET');
  metricsService.recordRequest(503, 950, 'POST');
  metricsService.recordQueueEnqueued('notifications');
  metricsService.recordQueueProcessed('notifications', true);
  metricsService.recordQueueEnqueued('media-jobs');
  metricsService.recordQueueProcessed('media-jobs', false);
  metricsService.recordWebhookProcessed(true);
  metricsService.recordWebhookProcessed(false);
  await app.init();
});

test.after(async () => {
  await app.close();
});

void test('GET /metrics returns prometheus counters', async () => {
  const server = app.getHttpServer() as unknown as Server;
  const response = await request(server).get('/metrics');

  assert.equal(response.status, 200);
  assert.match(response.text, /studioos_http_requests_total 2/);
  assert.match(response.text, /studioos_http_errors_total 1/);
  assert.match(response.text, /studioos_api_read_latency_ms_count 1/);
  assert.match(response.text, /studioos_api_write_latency_ms_count 1/);
  assert.match(response.text, /studioos_queue_depth\{queue="notifications"\} 0/);
  assert.match(response.text, /studioos_webhook_processed_total 1/);
  assert.match(response.text, /studioos_webhook_failed_total 1/);
  assert.match(response.text, /studioos_worker_jobs_total\{worker="media",status="failure"\} 1/);
});
