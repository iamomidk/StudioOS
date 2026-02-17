import assert from 'node:assert/strict';
import test from 'node:test';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';

const requiredEnv = {
  DATABASE_URL: 'postgresql://localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-placeholder',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-placeholder'
};

void test('GET /health returns 200', async () => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, requiredEnv);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app: INestApplication = moduleRef.createNestApplication();
  await app.init();

  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  const response = await request(httpServer).get('/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });

  await app.close();
  process.env = previousEnv;
});
