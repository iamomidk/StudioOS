import assert from 'node:assert/strict';
import test from 'node:test';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { RequestLoggingInterceptor } from '../src/common/interceptors/request-logging.interceptor.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

const env = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
  REGION_ID: 'us-east-1',
  PRIMARY_REGION: 'us-east-1',
  FAILOVER_MODE: 'off',
  REGION_DATA_POLICY: 'global',
  FEATURE_PUBLIC_LAUNCH_ENABLED: 'true',
  PUBLIC_ROLLOUT_PERCENTAGE: '100'
};

async function createApp(): Promise<INestApplication> {
  Object.assign(process.env, env);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  await app.init();
  return app;
}

void test('launch health dashboard endpoint returns rollout and ops status payload', async () => {
  const previousEnv = { ...process.env };
  const app = await createApp();
  const prisma = app.get(PrismaService);
  const suffix = Date.now().toString();

  const organization = await prisma.organization.create({
    data: {
      name: `Launch Health Org ${suffix}`,
      pilotOrg: true
    }
  });
  const user = await prisma.user.create({
    data: {
      email: `launch-health-${suffix}@studioos.dev`,
      firstName: 'Launch',
      lastName: 'Owner',
      passwordHash: await bcrypt.hash('Password123!', 10)
    }
  });
  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: 'owner'
    }
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  const token = (login.body as { accessToken: string }).accessToken;

  const launchHealth = await request(server)
    .get('/launch/health')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(launchHealth.status, 200);
  const payload = launchHealth.body as {
    rollout: { publicLaunchEnabled: boolean };
    region: { regionId: string; failoverMode: string };
    errorBudget: { burnRate: number };
    queue: { depth: Record<string, number> };
    webhook: { failureRate: number };
  };
  assert.equal(payload.rollout.publicLaunchEnabled, true);
  assert.equal(payload.region.regionId, 'us-east-1');
  assert.equal(payload.region.failoverMode, 'off');
  assert.equal(typeof payload.errorBudget.burnRate, 'number');
  assert.equal(typeof payload.queue.depth, 'object');
  assert.equal(typeof payload.webhook.failureRate, 'number');

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });
  await app.close();
  process.env = previousEnv;
});
