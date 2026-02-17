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
  FEATURE_DISPUTES_ENABLED: 'true',
  FEATURE_PUBLIC_LAUNCH_ENABLED: 'true',
  PUBLIC_ROLLOUT_PERCENTAGE: '100',
  DISPUTE_POLICY_VERSION: 'v2-test'
};

void test('dispute automation policy triages, versions decisions, and supports auditable overrides', async () => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, baseEnv);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  await app.init();

  const prisma = app.get(PrismaService);
  const suffix = Date.now().toString();

  const organization = await prisma.organization.create({
    data: { name: `Dispute Auto Org ${suffix}` }
  });
  const user = await prisma.user.create({
    data: {
      email: `dispute-auto-${suffix}@studioos.dev`,
      firstName: 'Dispute',
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
  assert.equal(login.status, 200);
  const token = (login.body as { accessToken: string }).accessToken;

  const create = await request(server)
    .post('/disputes')
    .set('Authorization', `Bearer ${token}`)
    .send({
      organizationId: organization.id,
      entityType: 'RentalOrder',
      entityId: 'rental-1',
      reason: 'High value damage claim',
      disputeType: 'damage',
      rentalValueCents: 250000,
      customerRiskTier: 'high',
      providerRiskTier: 'medium',
      evidence: {
        checkInPhotoUrl: 'https://example.com/check-in.jpg',
        note: 'Scratch found',
        actorId: user.id,
        occurredAt: new Date().toISOString(),
        contentType: 'image/jpeg'
      }
    });

  assert.equal(create.status, 201);
  const created = create.body as {
    id: string;
    policyVersion: string;
    severity: string;
    assignedTeam: string;
    slaClass: string;
    evidenceScore: number;
    decisionTrace: string[];
    missingEvidenceTemplateKey: string | null;
  };

  assert.equal(created.policyVersion, 'v2-test');
  assert.equal(created.severity, 'critical');
  assert.equal(created.assignedTeam, 'incident_response');
  assert.equal(created.slaClass, 'urgent');
  assert.equal(created.evidenceScore >= 70, true);
  assert.ok(created.decisionTrace.some((item) => item.includes('damage_high_exposure_critical')));
  assert.equal(created.missingEvidenceTemplateKey, null);

  const override = await request(server)
    .patch(`/disputes/${created.id}/override?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      severity: 'medium',
      assignedTeam: 'billing_ops',
      slaClass: 'expedited',
      reason: 'Manual triage after evidence review'
    });
  assert.equal(override.status, 200);
  assert.equal((override.body as { severity: string }).severity, 'medium');
  assert.equal((override.body as { assignedTeam: string }).assignedTeam, 'billing_ops');

  const metrics = await request(server)
    .get(`/disputes/metrics?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(metrics.status, 200);
  assert.equal((metrics.body as { totals: { disputes: number } }).totals.disputes, 1);
  assert.equal((metrics.body as { totals: { autoTriaged: number } }).totals.autoTriaged, 0);

  const markInProgress = await request(server)
    .patch(`/disputes/${created.id}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'under_review' });
  assert.equal(markInProgress.status, 200);

  const markResolved = await request(server)
    .patch(`/disputes/${created.id}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'resolved' });
  assert.equal(markResolved.status, 200);

  const metricsAfterResolution = await request(server)
    .get(`/disputes/metrics?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(metricsAfterResolution.status, 200);
  assert.equal(
    (metricsAfterResolution.body as { resolutionRateByType: { damage: number } })
      .resolutionRateByType.damage,
    1
  );

  const overrideAudit = await prisma.auditLog.findFirst({
    where: {
      organizationId: organization.id,
      entityType: 'Dispute',
      entityId: created.id,
      action: 'dispute.policy.overridden'
    }
  });
  assert.ok(overrideAudit);

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
