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

const requiredEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests'
};

void test('trust/safety moderation detects violations, supports review/appeals, and exposes metrics', async () => {
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
      name: `Trust Safety Org ${suffix}`
    }
  });

  const owner = await prisma.user.create({
    data: {
      email: `trust-safety-${suffix}@studioos.dev`,
      firstName: 'Trust',
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

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({
    email: owner.email,
    password: 'Password123!'
  });
  assert.equal(login.status, 200);
  const accessToken = (login.body as { accessToken: string }).accessToken;

  const policy = await request(server)
    .post('/trust-safety/policies')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      name: `core-policy-${suffix}`,
      violationTypes: ['fraud', 'harassment'],
      keywordRules: ['scam', 'fraud', 'abuse']
    });
  assert.equal(policy.status, 201);

  const cleanResult = await request(server)
    .post('/trust-safety/moderate')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      entityType: 'message',
      entityId: `msg-clean-${suffix}`,
      content: 'hello team'
    });
  assert.equal(cleanResult.status, 201);
  assert.equal((cleanResult.body as { action: string }).action, 'allow');

  const violationResult = await request(server)
    .post('/trust-safety/moderate')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      entityType: 'message',
      entityId: `msg-violation-${suffix}`,
      content: 'this is a scam fraud pattern and abuse',
      source: 'web'
    });
  assert.equal(violationResult.status, 201);
  const moderationCaseId = (violationResult.body as { caseId: string }).caseId;
  assert.equal(typeof moderationCaseId, 'string');

  const casesResponse = await request(server)
    .get('/trust-safety/cases')
    .query({ organizationId: organization.id })
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(casesResponse.status, 200);
  const cases = casesResponse.body as Array<{ id: string }>;
  assert.equal(
    cases.some((item) => item.id === moderationCaseId),
    true
  );

  const decision = await request(server)
    .post(`/trust-safety/cases/${moderationCaseId}/decisions`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      action: 'block',
      note: 'Confirmed fraud pattern',
      sanctionDays: 30
    });
  assert.equal(decision.status, 201);

  const appeal = await request(server)
    .post(`/trust-safety/cases/${moderationCaseId}/appeals`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      reason: 'Request secondary review'
    });
  assert.equal(appeal.status, 201);

  const abuseReport = await request(server)
    .post('/trust-safety/reports')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      entityType: 'listing',
      entityId: `listing-${suffix}`,
      message: 'Suspicious behavior in listing description',
      attachmentType: 'image/png',
      attachmentUrl: 'https://example.invalid/evidence.png'
    });
  assert.equal(abuseReport.status, 201);

  const metrics = await request(server)
    .get('/trust-safety/metrics')
    .query({ organizationId: organization.id })
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(metrics.status, 200);
  const metricsBody = metrics.body as {
    totalCases: number;
    sanctionsActive: number;
    appeals: number;
  };
  assert.equal(metricsBody.totalCases >= 1, true);
  assert.equal(metricsBody.sanctionsActive >= 1, true);
  assert.equal(metricsBody.appeals >= 1, true);

  await app.close();
  process.env = previousEnv;
});
