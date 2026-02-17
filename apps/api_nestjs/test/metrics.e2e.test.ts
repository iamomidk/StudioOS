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
  metricsService.recordRequest(200);
  metricsService.recordRequest(503);
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
});
