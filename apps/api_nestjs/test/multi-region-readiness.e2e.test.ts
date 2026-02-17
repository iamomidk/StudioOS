import assert from 'node:assert/strict';
import test from 'node:test';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-placeholder',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-placeholder',
  REGION_DATA_POLICY: 'regional-boundary'
};

async function createApp(overrides: Record<string, string>): Promise<INestApplication> {
  Object.assign(process.env, baseEnv, overrides);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  await app.init();
  return app;
}

interface FailoverStatusBody {
  failoverMode: string;
  auth: { tokenVerificationReady: boolean };
}

interface FailoverBlockedBody {
  code: string;
}

void test('region headers are exposed and failover controls route traffic deterministically', async () => {
  const previousEnv = { ...process.env };

  const healthyApp = await createApp({
    REGION_ID: 'eu-west-1',
    PRIMARY_REGION: 'us-east-1',
    FAILOVER_MODE: 'passive',
    TRAFFIC_SHIFT_PERCENTAGE: '100',
    MAINTENANCE_MODE_REGIONS: ''
  });

  const healthyServer = healthyApp.getHttpServer() as Parameters<typeof request>[0];
  const healthyResponse = await request(healthyServer).get('/health');
  assert.equal(healthyResponse.status, 200);
  assert.equal(healthyResponse.headers['x-serving-region'], 'eu-west-1');
  assert.equal(healthyResponse.headers['x-primary-region'], 'us-east-1');
  assert.equal(healthyResponse.headers['x-failover-mode'], 'passive');
  assert.equal(healthyResponse.headers['x-region-data-policy'], 'regional-boundary');

  const failoverStatus = await request(healthyServer).get('/health/failover');
  assert.equal(failoverStatus.status, 200);
  const failoverBody = failoverStatus.body as FailoverStatusBody;
  assert.equal(failoverBody.failoverMode, 'passive');
  assert.equal(failoverBody.auth.tokenVerificationReady, true);

  await healthyApp.close();

  const shiftedApp = await createApp({
    REGION_ID: 'eu-west-1',
    PRIMARY_REGION: 'us-east-1',
    FAILOVER_MODE: 'passive',
    TRAFFIC_SHIFT_PERCENTAGE: '0',
    MAINTENANCE_MODE_REGIONS: ''
  });
  const shiftedServer = shiftedApp.getHttpServer() as Parameters<typeof request>[0];
  const shiftedResponse = await request(shiftedServer).get('/health');
  assert.equal(shiftedResponse.status, 503);
  const shiftedBody = shiftedResponse.body as FailoverBlockedBody;
  assert.equal(shiftedBody.code, 'REGION_TRAFFIC_SHIFTED');
  await shiftedApp.close();

  const maintenanceApp = await createApp({
    REGION_ID: 'us-east-1',
    PRIMARY_REGION: 'us-east-1',
    FAILOVER_MODE: 'off',
    TRAFFIC_SHIFT_PERCENTAGE: '100',
    MAINTENANCE_MODE_REGIONS: 'us-east-1',
    MAINTENANCE_BYPASS_TOKEN: 'bypass-token'
  });
  const maintenanceServer = maintenanceApp.getHttpServer() as Parameters<typeof request>[0];

  const blocked = await request(maintenanceServer).get('/health');
  assert.equal(blocked.status, 503);
  const blockedBody = blocked.body as FailoverBlockedBody;
  assert.equal(blockedBody.code, 'REGION_MAINTENANCE');

  const bypassed = await request(maintenanceServer)
    .get('/health')
    .set('x-region-maintenance-bypass', 'bypass-token');
  assert.equal(bypassed.status, 200);

  await maintenanceApp.close();
  process.env = previousEnv;
});
