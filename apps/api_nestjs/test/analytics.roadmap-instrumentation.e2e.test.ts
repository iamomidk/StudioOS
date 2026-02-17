import assert from 'node:assert/strict';
import test from 'node:test';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { RequestLoggingInterceptor } from '../src/common/interceptors/request-logging.interceptor.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

const requiredEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests'
};

void test('roadmap instrumentation creates versioned metric definitions, generates weekly scorecards, and links experiments to KPI movement', async () => {
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
  const suffix = Date.now().toString();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const organization = await prisma.organization.create({
    data: {
      name: `Roadmap Org ${suffix}`
    }
  });

  const owner = await prisma.user.create({
    data: {
      email: `roadmap-${suffix}@studioos.dev`,
      firstName: 'Roadmap',
      lastName: 'Owner',
      passwordHash
    }
  });

  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: owner.id,
      role: 'owner'
    }
  });

  const now = new Date();
  const eventSeed = [
    { eventName: 'lead_created', offsetDays: 6 },
    { eventName: 'lead_created', offsetDays: 5 },
    { eventName: 'booking_created', offsetDays: 4 },
    { eventName: 'quote_sent', offsetDays: 4, entityId: `quote-${suffix}` },
    { eventName: 'quote_accepted', offsetDays: 3, entityId: `quote-${suffix}` },
    { eventName: 'rental_reserved', offsetDays: 3 },
    { eventName: 'rental_returned', offsetDays: 2 },
    { eventName: 'invoice_issued', offsetDays: 2, entityId: `invoice-${suffix}` },
    { eventName: 'invoice_paid', offsetDays: 1, entityId: `invoice-${suffix}` }
  ];

  await Promise.all(
    eventSeed.map((event, index) =>
      prisma.analyticsEvent.create({
        data: {
          organizationId: organization.id,
          eventName: event.eventName,
          actorRole: 'owner',
          source: 'api',
          entityType: event.entityId ? 'entity' : null,
          entityId: event.entityId ?? null,
          payload: Prisma.JsonNull,
          occurredAt: new Date(now.getTime() - event.offsetDays * 24 * 3600 * 1000 + index * 1000),
          pilotOrg: false,
          pilotCohortId: null
        }
      })
    )
  );

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({
    email: owner.email,
    password: 'Password123!'
  });
  assert.equal(login.status, 200);
  const accessToken = (login.body as { accessToken: string }).accessToken;

  const northStar = await request(server)
    .post('/analytics/roadmap/definitions')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      kind: 'north_star',
      metricKey: 'conversion_rate',
      title: 'Lead to Booking Conversion',
      formula: 'booking_created / lead_created',
      owner: 'growth',
      targetValue: 0.4
    });
  assert.equal(northStar.status, 201);
  const definitionId = (northStar.body as { id: string }).id;

  const leading = await request(server)
    .post('/analytics/roadmap/definitions')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      kind: 'leading_indicator',
      metricKey: 'fill_rate',
      title: 'Rental Fill Rate',
      formula: 'rental_returned / rental_reserved',
      owner: 'ops',
      targetValue: 0.9
    });
  assert.equal(leading.status, 201);

  const version = await request(server)
    .patch(`/analytics/roadmap/definitions/${definitionId}/version`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      formula: 'booking_created / lead_created',
      targetValue: 0.5,
      changeReason: 'Q1 target adjustment'
    });
  assert.equal(version.status, 200);
  assert.equal((version.body as { versionNumber: number }).versionNumber > 1, true);

  const scorecard = await request(server)
    .post('/analytics/roadmap/scorecards/generate')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      frequency: 'weekly',
      windowDays: 7,
      experimentId: 'exp-ranking-v3'
    });
  assert.equal(scorecard.status, 201);
  const scorecardBody = scorecard.body as {
    metrics: Array<{ metricKey: string; experimentImpacts: unknown[] }>;
    onTrack: boolean;
  };
  assert.equal(scorecardBody.metrics.length >= 2, true);
  assert.equal(
    scorecardBody.metrics.some(
      (metric) => metric.metricKey === 'conversion_rate' && metric.experimentImpacts.length >= 1
    ),
    true
  );
  assert.equal(typeof scorecardBody.onTrack, 'boolean');

  const listScorecards = await request(server)
    .get('/analytics/roadmap/scorecards')
    .query({ organizationId: organization.id, frequency: 'weekly' })
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(listScorecards.status, 200);
  const listed = listScorecards.body as Array<{ metrics: unknown[] }>;
  assert.equal(listed.length >= 1, true);
  assert.equal((listed[0]?.metrics.length ?? 0) >= 2, true);

  await app.close();
  process.env = previousEnv;
});
