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
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
  BILLING_USAGE_ANOMALY_THRESHOLD: '100000'
};

void test('enterprise billing supports seat usage hybrid, proration, true-up, and idempotent usage ingestion', async () => {
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
    data: { name: `Enterprise Billing Org ${suffix}` }
  });
  const user = await prisma.user.create({
    data: {
      email: `ent-billing-${suffix}@studioos.dev`,
      firstName: 'Enterprise',
      lastName: 'Owner',
      passwordHash
    }
  });
  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: 'owner'
    }
  });

  const client = await prisma.client.create({
    data: {
      organizationId: organization.id,
      name: 'Enterprise Client',
      email: `client-${suffix}@example.com`
    }
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  assert.equal(login.status, 200);
  const accessToken = (login.body as { accessToken: string }).accessToken;

  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));

  const createSeatPlan = await request(server)
    .post('/billing/enterprise/plans')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      code: `seat-plan-${suffix}`,
      name: 'Seat Plan',
      billingCycle: 'monthly',
      currency: 'USD',
      effectiveFrom: periodStart.toISOString(),
      components: [
        {
          componentType: 'seat',
          code: 'editor_seat',
          displayName: 'Editor Seat',
          unitPriceCents: 1500,
          includedUnits: 0,
          minimumUnits: 0
        }
      ]
    });
  assert.equal(createSeatPlan.status, 201);
  const seatPlan = createSeatPlan.body as { id: string; versionId: string };

  const seatSubscriptionResp = await request(server)
    .post('/billing/enterprise/subscriptions')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId: client.id,
      planId: seatPlan.id,
      planVersionId: seatPlan.versionId,
      startsAt: periodStart.toISOString(),
      seatQuantities: {
        editor_seat: 10
      }
    });
  assert.equal(seatSubscriptionResp.status, 201);
  const seatSubscriptionId = (seatSubscriptionResp.body as { id: string }).id;

  const seatChange = await request(server)
    .patch(`/billing/enterprise/subscriptions/${seatSubscriptionId}/seats`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      componentCode: 'editor_seat',
      quantity: 14
    });
  assert.equal(seatChange.status, 200);
  assert.equal(
    typeof (seatChange.body as { prorationDeltaCents: number }).prorationDeltaCents,
    'number'
  );

  const seatClosePeriod = await request(server)
    .post(`/billing/enterprise/subscriptions/${seatSubscriptionId}/close-period`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });
  assert.equal(seatClosePeriod.status, 201);
  const seatCloseBody = seatClosePeriod.body as {
    invoice: { id: string; totalCents: number };
    lines: Array<{ lineType: string; quantity: number; amountCents: number }>;
  };
  assert.equal(
    seatCloseBody.lines.some((line) => line.lineType === 'seat'),
    true
  );
  assert.equal(seatCloseBody.invoice.totalCents > 0, true);

  const createUsagePlan = await request(server)
    .post('/billing/enterprise/plans')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      code: `usage-plan-${suffix}`,
      name: 'Usage Plan',
      billingCycle: 'monthly',
      currency: 'USD',
      effectiveFrom: periodStart.toISOString(),
      components: [
        {
          componentType: 'usage',
          code: 'api_calls',
          displayName: 'API Calls',
          unitPriceCents: 5,
          includedUnits: 100,
          minimumUnits: 0
        }
      ]
    });
  assert.equal(createUsagePlan.status, 201);
  const usagePlan = createUsagePlan.body as { id: string; versionId: string };

  const usageSubscriptionResp = await request(server)
    .post('/billing/enterprise/subscriptions')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId: client.id,
      planId: usagePlan.id,
      planVersionId: usagePlan.versionId,
      startsAt: periodStart.toISOString()
    });
  assert.equal(usageSubscriptionResp.status, 201);
  const usageSubscriptionId = (usageSubscriptionResp.body as { id: string }).id;

  const ingestUsage = await request(server)
    .post(`/billing/enterprise/subscriptions/${usageSubscriptionId}/usage`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      meterCode: 'api_calls',
      quantity: 250,
      usageAt: periodStart.toISOString(),
      dedupKey: `dedup-${suffix}`
    });
  assert.equal(ingestUsage.status, 201);
  assert.equal((ingestUsage.body as { duplicate: boolean }).duplicate, false);

  const ingestDuplicate = await request(server)
    .post(`/billing/enterprise/subscriptions/${usageSubscriptionId}/usage`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      meterCode: 'api_calls',
      quantity: 250,
      usageAt: periodStart.toISOString(),
      dedupKey: `dedup-${suffix}`
    });
  assert.equal(ingestDuplicate.status, 201);
  assert.equal((ingestDuplicate.body as { duplicate: boolean }).duplicate, true);

  const usageClosePeriod = await request(server)
    .post(`/billing/enterprise/subscriptions/${usageSubscriptionId}/close-period`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });
  assert.equal(usageClosePeriod.status, 201);
  const usageCloseBody = usageClosePeriod.body as {
    lines: Array<{ lineType: string; quantity: number; amountCents: number }>;
  };
  const usageLine = usageCloseBody.lines.find((line) => line.lineType === 'usage');
  assert.ok(usageLine);
  assert.equal(usageLine?.quantity, 150);
  assert.equal(usageLine?.amountCents, 750);

  const createHybridPlan = await request(server)
    .post('/billing/enterprise/plans')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      code: `hybrid-plan-${suffix}`,
      name: 'Hybrid Plan',
      billingCycle: 'monthly',
      currency: 'USD',
      minimumCommitCents: 30000,
      effectiveFrom: periodStart.toISOString(),
      components: [
        {
          componentType: 'fixed',
          code: 'platform_fee',
          displayName: 'Platform Fee',
          unitPriceCents: 12000
        },
        {
          componentType: 'seat',
          code: 'ops_seat',
          displayName: 'Ops Seat',
          unitPriceCents: 3000
        },
        {
          componentType: 'usage',
          code: 'render_minutes',
          displayName: 'Render Minutes',
          unitPriceCents: 10,
          includedUnits: 20
        }
      ]
    });
  assert.equal(createHybridPlan.status, 201);
  const hybridPlan = createHybridPlan.body as { id: string; versionId: string };

  const hybridSubscriptionResp = await request(server)
    .post('/billing/enterprise/subscriptions')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId: client.id,
      planId: hybridPlan.id,
      planVersionId: hybridPlan.versionId,
      startsAt: periodStart.toISOString(),
      seatQuantities: {
        ops_seat: 2
      }
    });
  assert.equal(hybridSubscriptionResp.status, 201);
  const hybridSubscriptionId = (hybridSubscriptionResp.body as { id: string }).id;

  const hybridClosePeriod = await request(server)
    .post(`/billing/enterprise/subscriptions/${hybridSubscriptionId}/close-period`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });
  assert.equal(hybridClosePeriod.status, 201);
  const hybridCloseBody = hybridClosePeriod.body as {
    trueUp: { amountCents: number };
    invoice: { totalCents: number };
    lines: Array<{ lineType: string }>;
  };
  assert.equal(hybridCloseBody.trueUp.amountCents > 0, true);
  assert.equal(
    hybridCloseBody.lines.some((line) => line.lineType === 'true_up'),
    true
  );
  assert.equal(hybridCloseBody.invoice.totalCents >= 30000, true);

  const history = await request(server)
    .get(
      `/billing/enterprise/subscriptions/${seatSubscriptionId}/history?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(history.status, 200);
  const historyBody = history.body as {
    seatChanges: unknown[];
    trueUps: unknown[];
    auditTrail: unknown[];
  };
  assert.equal(historyBody.seatChanges.length > 0, true);
  assert.equal(historyBody.trueUps.length > 0, true);
  assert.equal(historyBody.auditTrail.length > 0, true);

  const report = await request(server)
    .get(`/billing/enterprise/reports?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(report.status, 200);
  assert.equal(typeof (report.body as { mrrCents: number }).mrrCents, 'number');

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.billingAdjustmentRequest.deleteMany({ where: { organizationId: organization.id } });
  await prisma.billingInvoiceLine.deleteMany({ where: { organizationId: organization.id } });
  await prisma.billingTrueUpRecord.deleteMany({ where: { organizationId: organization.id } });
  await prisma.billingUsageRecord.deleteMany({ where: { organizationId: organization.id } });
  await prisma.billingMeter.deleteMany({ where: { organizationId: organization.id } });
  await prisma.billingSubscriptionSeatChangeLog.deleteMany({
    where: { organizationId: organization.id }
  });
  await prisma.billingSubscriptionItem.deleteMany({
    where: { subscription: { organizationId: organization.id } }
  });
  await prisma.billingSubscription.deleteMany({ where: { organizationId: organization.id } });
  await prisma.billingPriceComponent.deleteMany({
    where: { planVersion: { organizationId: organization.id } }
  });
  await prisma.billingPlanVersion.deleteMany({ where: { organizationId: organization.id } });
  await prisma.billingPlan.deleteMany({ where: { organizationId: organization.id } });
  await prisma.paymentWebhookEvent.deleteMany({ where: { organizationId: organization.id } });
  await prisma.payment.deleteMany({ where: { organizationId: organization.id } });
  await prisma.invoice.deleteMany({ where: { organizationId: organization.id } });
  await prisma.client.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
