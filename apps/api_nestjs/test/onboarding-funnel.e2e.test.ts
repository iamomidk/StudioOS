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

interface AuthTokensResponse {
  accessToken: string;
}

function bootstrap(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
}

void test('onboarding funnel reports step completion, median transitions, and cohort dashboard', async () => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
    JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
    ONBOARDING_STEPS:
      'org_created,first_lead_created,first_quote_sent,first_booking_created,first_invoice_issued',
    ACTIVATION_REQUIRED_STEPS: 'first_booking_created,first_invoice_issued'
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  bootstrap(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const analytics = app.get(AnalyticsService);

  const suffix = Date.now().toString();
  const password = 'Password123!';
  const cohortId = `cohort-onboarding-${suffix}`;

  const orgA = await prisma.organization.create({
    data: { name: `Onboarding A ${suffix}`, pilotOrg: true, pilotCohortId: cohortId }
  });
  const orgB = await prisma.organization.create({
    data: { name: `Onboarding B ${suffix}`, pilotOrg: true, pilotCohortId: cohortId }
  });

  const owner = await prisma.user.create({
    data: {
      email: `onboarding-owner-${suffix}@studioos.dev`,
      firstName: 'Onboarding',
      lastName: 'Owner',
      passwordHash: await bcrypt.hash(password, 10)
    }
  });

  await prisma.membership.createMany({
    data: [
      { organizationId: orgA.id, userId: owner.id, role: 'owner' },
      { organizationId: orgB.id, userId: owner.id, role: 'owner' }
    ]
  });

  const now = Date.now();
  const hours = (value: number) => new Date(now + value * 60 * 60 * 1000);

  await analytics.recordEvent({
    organizationId: orgA.id,
    eventName: 'lead_created',
    actorRole: 'owner',
    source: 'api',
    occurredAt: hours(0),
    idempotencyKey: `orgA-lead-${suffix}`
  });
  await analytics.recordEvent({
    organizationId: orgA.id,
    eventName: 'quote_sent',
    actorRole: 'owner',
    source: 'api',
    occurredAt: hours(24),
    idempotencyKey: `orgA-quote-${suffix}`
  });
  await analytics.recordEvent({
    organizationId: orgA.id,
    eventName: 'booking_created',
    actorRole: 'owner',
    source: 'api',
    occurredAt: hours(48),
    idempotencyKey: `orgA-booking-${suffix}`
  });
  await analytics.recordEvent({
    organizationId: orgA.id,
    eventName: 'invoice_issued',
    actorRole: 'owner',
    source: 'api',
    occurredAt: hours(72),
    idempotencyKey: `orgA-invoice-${suffix}`
  });

  await analytics.recordEvent({
    organizationId: orgB.id,
    eventName: 'lead_created',
    actorRole: 'owner',
    source: 'api',
    occurredAt: hours(0),
    idempotencyKey: `orgB-lead-${suffix}`
  });
  await analytics.recordEvent({
    organizationId: orgB.id,
    eventName: 'quote_sent',
    actorRole: 'owner',
    source: 'api',
    occurredAt: hours(48),
    idempotencyKey: `orgB-quote-${suffix}`
  });
  await analytics.recordEvent({
    organizationId: orgB.id,
    eventName: 'booking_created',
    actorRole: 'owner',
    source: 'api',
    occurredAt: hours(72),
    idempotencyKey: `orgB-booking-${suffix}`
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({ email: owner.email, password });
  assert.equal(login.status, 200);
  const accessToken = (login.body as AuthTokensResponse).accessToken;

  const funnel = await request(server)
    .get(`/analytics/onboarding-funnel?pilotCohortId=${encodeURIComponent(cohortId)}&days=30`)
    .set('Authorization', `Bearer ${accessToken}`);

  assert.equal(funnel.status, 200);
  assert.equal((funnel.body as { totalOrgs: number }).totalOrgs, 2);
  assert.equal((funnel.body as { activationRate: number }).activationRate, 0.5);

  const quoteStep = (
    funnel.body as {
      steps: Array<{ step: string; medianHoursFromPrevious: number }>;
    }
  ).steps.find((row) => row.step === 'first_quote_sent');
  assert.ok(quoteStep);
  assert.equal(quoteStep?.medianHoursFromPrevious, 36);

  const quality = funnel.body as { quality: { outOfOrderEvents: number } };
  assert.equal(quality.quality.outOfOrderEvents, 0);

  const dashboard = await request(server)
    .get(
      `/analytics/onboarding-funnel/dashboard?pilotCohortId=${encodeURIComponent(cohortId)}&days=30`
    )
    .set('Authorization', `Bearer ${accessToken}`);

  assert.equal(dashboard.status, 200);
  assert.equal(
    (
      dashboard.body as {
        cohortBreakdown: Array<{ pilotCohortId: string; totalOrgs: number; activatedOrgs: number }>;
      }
    ).cohortBreakdown.some(
      (row) => row.pilotCohortId === cohortId && row.totalOrgs === 2 && row.activatedOrgs === 1
    ),
    true
  );

  await prisma.pricingConversionEventLink.deleteMany({
    where: { exposureLog: { organizationId: { in: [orgA.id, orgB.id] } } }
  });
  await prisma.pricingExposureLog.deleteMany({
    where: { organizationId: { in: [orgA.id, orgB.id] } }
  });
  await prisma.analyticsEvent.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.membership.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.user.deleteMany({ where: { id: owner.id } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });

  await app.close();
  process.env = previousEnv;
});

void test('activation definition is configurable via env steps', async () => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
    JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
    ONBOARDING_STEPS: 'org_created,first_booking_created,first_invoice_issued',
    ACTIVATION_REQUIRED_STEPS: 'first_booking_created'
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  bootstrap(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const analytics = app.get(AnalyticsService);

  const suffix = `${Date.now()}-cfg`;
  const password = 'Password123!';
  const organization = await prisma.organization.create({
    data: { name: `Activation Config ${suffix}`, pilotOrg: true, pilotCohortId: 'cohort-config' }
  });

  const owner = await prisma.user.create({
    data: {
      email: `activation-owner-${suffix}@studioos.dev`,
      firstName: 'Activation',
      lastName: 'Owner',
      passwordHash: await bcrypt.hash(password, 10)
    }
  });

  await prisma.membership.create({
    data: { organizationId: organization.id, userId: owner.id, role: 'owner' }
  });

  await analytics.recordEvent({
    organizationId: organization.id,
    eventName: 'booking_created',
    actorRole: 'owner',
    source: 'api',
    idempotencyKey: `booking-created-${suffix}`
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({ email: owner.email, password });
  assert.equal(login.status, 200);
  const accessToken = (login.body as AuthTokensResponse).accessToken;

  const funnel = await request(server)
    .get(
      `/analytics/onboarding-funnel?organizationId=${encodeURIComponent(organization.id)}&days=30`
    )
    .set('Authorization', `Bearer ${accessToken}`);

  assert.equal(funnel.status, 200);
  assert.equal((funnel.body as { activationRate: number }).activationRate, 1);

  await prisma.pricingConversionEventLink.deleteMany({
    where: { exposureLog: { organizationId: organization.id } }
  });
  await prisma.pricingExposureLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.analyticsEvent.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.user.deleteMany({ where: { id: owner.id } });
  await prisma.organization.deleteMany({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
