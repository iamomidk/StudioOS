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

function applyTestBootstrap(app: INestApplication) {
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

void test('pricing experiments assignment is deterministic and conversion metrics are queryable', async () => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
    JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
    FEATURE_PRICING_EXPERIMENTS_ENABLED: 'true',
    PRICING_EXPERIMENTS_GLOBAL_KILL_SWITCH: 'false'
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  applyTestBootstrap(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const analytics = app.get(AnalyticsService);

  const suffix = Date.now().toString();
  const password = 'Password123!';

  const organization = await prisma.organization.create({
    data: {
      name: `Experiment Org ${suffix}`,
      pilotOrg: true,
      pilotCohortId: 'cohort-exp'
    }
  });

  const user = await prisma.user.create({
    data: {
      email: `pricing-owner-${suffix}@studioos.dev`,
      firstName: 'Pricing',
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

  const server = app.getHttpServer() as Parameters<typeof request>[0];

  const login = await request(server).post('/auth/login').send({ email: user.email, password });
  assert.equal(login.status, 200);
  const accessToken = (login.body as AuthTokensResponse).accessToken;

  const create = await request(server)
    .post('/analytics/pricing-experiments')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      key: `exp-${suffix}`,
      name: 'Pilot Pricing Experiment',
      description: 'test',
      variants: [
        { key: 'control', name: 'Control', weight: 1, pricingMultiplier: 1 },
        { key: 'plus10', name: 'Plus 10%', weight: 1, pricingMultiplier: 1.1 }
      ],
      allocationRules: [{ targetType: 'cohort', targetValue: 'cohort-exp' }]
    });

  assert.equal(create.status, 201);
  const experimentId = (create.body as { id: string }).id;

  const activate = await request(server)
    .patch(`/analytics/pricing-experiments/${experimentId}/activate`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send();
  assert.equal(activate.status, 200);

  const evaluateA = await request(server)
    .post('/analytics/pricing-experiments/evaluate')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      baseAmountCents: 10000,
      entityType: 'Quote',
      entityId: `quote-${suffix}`,
      source: 'api'
    });

  assert.equal(evaluateA.status, 201);

  const evaluateB = await request(server)
    .post('/analytics/pricing-experiments/evaluate')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      baseAmountCents: 10000,
      entityType: 'Quote',
      entityId: `quote-${suffix}`,
      source: 'api'
    });

  assert.equal(evaluateB.status, 201);
  assert.equal(
    (evaluateA.body as { variantKey: string }).variantKey,
    (evaluateB.body as { variantKey: string }).variantKey
  );

  await analytics.recordEvent({
    organizationId: organization.id,
    eventName: 'quote_accepted',
    actorRole: 'owner',
    source: 'api',
    entityType: 'Quote',
    entityId: `quote-${suffix}`,
    idempotencyKey: `quote-accepted-${suffix}`
  });

  const metrics = await request(server)
    .get(`/analytics/pricing-experiments/${experimentId}/metrics?days=7`)
    .set('Authorization', `Bearer ${accessToken}`);

  assert.equal(metrics.status, 200);
  const variantRows = (
    metrics.body as { variants: Array<{ exposures: number; quoteAccepted: number }> }
  ).variants;
  assert.equal(
    variantRows.some((row) => row.exposures > 0),
    true
  );
  assert.equal(
    variantRows.some((row) => row.quoteAccepted > 0),
    true
  );

  await prisma.pricingConversionEventLink.deleteMany({
    where: { exposureLog: { organizationId: organization.id } }
  });
  await prisma.pricingExposureLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.pricingAllocationRule.deleteMany({ where: { experimentId } });
  await prisma.pricingVariant.deleteMany({ where: { experimentId } });
  await prisma.pricingExperiment.deleteMany({ where: { id: experimentId } });
  await prisma.analyticsEvent.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.organization.deleteMany({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});

void test('pricing experiments respect flag disable and kill switch', async () => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
    JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
    FEATURE_PRICING_EXPERIMENTS_ENABLED: 'false',
    PRICING_EXPERIMENTS_GLOBAL_KILL_SWITCH: 'false'
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  applyTestBootstrap(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const suffix = `${Date.now()}-kill`;
  const password = 'Password123!';

  const organization = await prisma.organization.create({
    data: {
      name: `Experiment Org ${suffix}`,
      pilotOrg: true,
      pilotCohortId: 'cohort-exp'
    }
  });

  const user = await prisma.user.create({
    data: {
      email: `pricing-owner-${suffix}@studioos.dev`,
      firstName: 'Pricing',
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

  const experiment = await prisma.pricingExperiment.create({
    data: {
      key: `exp-${suffix}`,
      name: 'Kill switch experiment',
      status: 'active',
      variants: {
        create: [
          { key: 'control', name: 'Control', weight: 1, pricingMultiplier: 1 },
          { key: 'plus20', name: 'Plus 20%', weight: 1, pricingMultiplier: 1.2 }
        ]
      },
      allocationRules: {
        create: [{ targetType: 'all' }]
      }
    }
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({ email: user.email, password });
  assert.equal(login.status, 200);
  const accessToken = (login.body as AuthTokensResponse).accessToken;

  const disabledEval = await request(server)
    .post('/analytics/pricing-experiments/evaluate')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      experimentKey: experiment.key,
      baseAmountCents: 5000,
      entityType: 'Quote',
      entityId: `quote-${suffix}`
    });

  assert.equal(disabledEval.status, 201);
  assert.equal((disabledEval.body as { experimentApplied: boolean }).experimentApplied, false);

  await app.close();

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
    JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
    FEATURE_PRICING_EXPERIMENTS_ENABLED: 'true',
    PRICING_EXPERIMENTS_GLOBAL_KILL_SWITCH: 'true'
  });

  const moduleRefKill = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const appKill: INestApplication = moduleRefKill.createNestApplication();
  applyTestBootstrap(appKill);
  await appKill.init();

  const serverKill = appKill.getHttpServer() as Parameters<typeof request>[0];
  const loginKill = await request(serverKill)
    .post('/auth/login')
    .send({ email: user.email, password });
  assert.equal(loginKill.status, 200);
  const killToken = (loginKill.body as AuthTokensResponse).accessToken;

  const killEval = await request(serverKill)
    .post('/analytics/pricing-experiments/evaluate')
    .set('Authorization', `Bearer ${killToken}`)
    .send({
      organizationId: organization.id,
      experimentKey: experiment.key,
      baseAmountCents: 5000,
      entityType: 'Quote',
      entityId: `quote-${suffix}-kill`
    });

  assert.equal(killEval.status, 201);
  assert.equal((killEval.body as { experimentApplied: boolean }).experimentApplied, false);

  await prisma.pricingConversionEventLink.deleteMany({
    where: { exposureLog: { organizationId: organization.id } }
  });
  await prisma.pricingExposureLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.pricingAllocationRule.deleteMany({ where: { experimentId: experiment.id } });
  await prisma.pricingVariant.deleteMany({ where: { experimentId: experiment.id } });
  await prisma.pricingExperiment.deleteMany({ where: { id: experiment.id } });
  await prisma.analyticsEvent.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.organization.deleteMany({ where: { id: organization.id } });

  await appKill.close();
  process.env = previousEnv;
});
