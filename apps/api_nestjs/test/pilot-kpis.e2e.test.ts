import assert from 'node:assert/strict';
import test from 'node:test';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { RequestLoggingInterceptor } from '../src/common/interceptors/request-logging.interceptor.js';
import { AnalyticsService } from '../src/modules/analytics/analytics.service.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

const requiredEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests'
};

interface AuthTokensResponse {
  accessToken: string;
}

void test('pilot KPI endpoint returns rolling trend and quality checks', async () => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, requiredEnv);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication();

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

  const prisma = app.get(PrismaService);
  const analytics = app.get(AnalyticsService);

  const suffix = Date.now().toString();
  const password = 'Password123!';

  const organization = await prisma.organization.create({
    data: {
      name: `Pilot Org ${suffix}`,
      pilotOrg: true,
      pilotCohortId: 'cohort-test'
    }
  });

  const user = await prisma.user.create({
    data: {
      email: `pilot-${suffix}@studioos.dev`,
      firstName: 'Pilot',
      lastName: 'Owner',
      passwordHash: await bcrypt.hash(password, 10)
    }
  });

  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: 'owner'
    }
  });

  const now = Date.now();
  for (let day = 0; day < 7; day += 1) {
    const occurredAt = new Date(now - day * 24 * 60 * 60 * 1000);
    await analytics.recordEvent({
      organizationId: organization.id,
      eventName: 'lead_created',
      actorRole: 'owner',
      source: 'api',
      entityType: 'Lead',
      entityId: `lead-${day}`,
      occurredAt,
      idempotencyKey: `lead-created-${suffix}-${day}`
    });
    await analytics.recordEvent({
      organizationId: organization.id,
      eventName: 'booking_created',
      actorRole: 'owner',
      source: 'api',
      entityType: 'Booking',
      entityId: `booking-${day}`,
      occurredAt,
      idempotencyKey: `booking-created-${suffix}-${day}`
    });
  }

  await analytics.recordEvent({
    organizationId: organization.id,
    eventName: 'invoice_issued',
    actorRole: 'owner',
    source: 'api',
    entityType: 'Invoice',
    entityId: `invoice-${suffix}`,
    occurredAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    idempotencyKey: `invoice-issued-${suffix}`
  });
  await analytics.recordEvent({
    organizationId: organization.id,
    eventName: 'invoice_paid',
    actorRole: 'owner',
    source: 'api',
    entityType: 'Invoice',
    entityId: `invoice-${suffix}`,
    occurredAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
    idempotencyKey: `invoice-paid-${suffix}`
  });

  await analytics.recordEvent({
    organizationId: organization.id,
    eventName: 'lead_created',
    actorRole: 'owner',
    source: 'api',
    entityType: 'Lead',
    entityId: 'dup-lead',
    idempotencyKey: `dup-key-${suffix}`
  });
  await analytics.recordEvent({
    organizationId: organization.id,
    eventName: 'lead_created',
    actorRole: 'owner',
    source: 'api',
    entityType: 'Lead',
    entityId: 'dup-lead-2',
    idempotencyKey: `dup-key-${suffix}`
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({ email: user.email, password });
  assert.equal(login.status, 200);
  const accessToken = (login.body as AuthTokensResponse).accessToken;

  const kpi = await request(server)
    .get(`/analytics/pilot-kpis?organizationId=${encodeURIComponent(organization.id)}&days=7`)
    .set('Authorization', `Bearer ${accessToken}`);

  assert.equal(kpi.status, 200);
  assert.equal((kpi.body as { trend: unknown[] }).trend.length, 7);
  assert.equal((kpi.body as { totals: { leadCreated: number } }).totals.leadCreated >= 7, true);

  const quality = await request(server)
    .get(
      `/analytics/pilot-kpis/quality?organizationId=${encodeURIComponent(organization.id)}&days=7`
    )
    .set('Authorization', `Bearer ${accessToken}`);

  assert.equal(quality.status, 200);
  assert.equal((quality.body as { duplicateIdempotencyKeys: number }).duplicateIdempotencyKeys, 0);

  await prisma.analyticsEvent.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.organization.deleteMany({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
