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

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
  PAYMENT_WEBHOOK_DEMO_SECRET: 'webhook-secret-for-tests'
};

async function bootApp(featureEnabled: boolean): Promise<INestApplication> {
  Object.assign(process.env, {
    ...baseEnv,
    FEATURE_DISPUTES_ENABLED: String(featureEnabled)
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  await app.init();
  return app;
}

void test('disputes feature flag controls module and emits audit entries', async () => {
  const previousEnv = { ...process.env };

  const appDisabled = await bootApp(false);
  const prismaDisabled = appDisabled.get(PrismaService);
  const suffix = Date.now().toString();

  const organization = await prismaDisabled.organization.create({
    data: { name: `Dispute Org ${suffix}` }
  });
  const user = await prismaDisabled.user.create({
    data: {
      email: `dispute-${suffix}@studioos.dev`,
      firstName: 'Dispute',
      lastName: 'Owner',
      passwordHash: await bcrypt.hash('Password123!', 10)
    }
  });
  await prismaDisabled.membership.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: 'owner'
    }
  });

  const disabledServer = appDisabled.getHttpServer() as Parameters<typeof request>[0];
  const loginDisabled = await request(disabledServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  const token = (loginDisabled.body as { accessToken: string }).accessToken;

  const disabledCreate = await request(disabledServer)
    .post('/disputes')
    .set('Authorization', `Bearer ${token}`)
    .send({
      organizationId: organization.id,
      entityType: 'Invoice',
      entityId: 'inv-1',
      reason: 'Mismatch'
    });
  assert.equal(disabledCreate.status, 404);

  await appDisabled.close();

  const appEnabled = await bootApp(true);
  const enabledServer = appEnabled.getHttpServer() as Parameters<typeof request>[0];
  const loginEnabled = await request(enabledServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  const enabledToken = (loginEnabled.body as { accessToken: string }).accessToken;

  const createDispute = await request(enabledServer)
    .post('/disputes')
    .set('Authorization', `Bearer ${enabledToken}`)
    .send({
      organizationId: organization.id,
      entityType: 'Invoice',
      entityId: 'inv-1',
      reason: 'Mismatch'
    });
  assert.equal(createDispute.status, 201);
  const disputeId = (createDispute.body as { id: string }).id;

  const updateStatus = await request(enabledServer)
    .patch(`/disputes/${disputeId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${enabledToken}`)
    .send({ status: 'under_review' });
  assert.equal(updateStatus.status, 200);

  const prismaEnabled = appEnabled.get(PrismaService);
  const auditCount = await prismaEnabled.auditLog.count({
    where: {
      organizationId: organization.id,
      entityType: 'Dispute'
    }
  });
  assert.equal(auditCount, 2);

  await prismaEnabled.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prismaEnabled.membership.deleteMany({ where: { organizationId: organization.id } });
  await prismaEnabled.refreshToken.deleteMany({ where: { userId: user.id } });
  await prismaEnabled.user.delete({ where: { id: user.id } });
  await prismaEnabled.organization.delete({ where: { id: organization.id } });

  await appEnabled.close();
  process.env = previousEnv;
});
