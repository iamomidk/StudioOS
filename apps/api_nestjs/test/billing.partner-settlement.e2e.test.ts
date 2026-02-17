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

void test('partner settlement computes statements, supports hold/release lifecycle, reconciliation, and carry-forward adjustments', async () => {
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
    data: { name: `Partner Settlement Org ${suffix}` }
  });

  const owner = await prisma.user.create({
    data: {
      email: `partner-settlement-${suffix}@studioos.dev`,
      firstName: 'Partner',
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

  const client = await prisma.client.create({
    data: {
      organizationId: organization.id,
      name: `Partner Settlement Client ${suffix}`
    }
  });

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      invoiceNumber: `SETTLE-${suffix}`,
      subtotalCents: 10000,
      taxCents: 0,
      totalCents: 10000,
      status: 'paid',
      issuedAt: new Date(),
      dueAt: new Date()
    }
  });

  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  await prisma.payment.create({
    data: {
      organizationId: organization.id,
      invoiceId: invoice.id,
      provider: 'manual',
      amountCents: 10000,
      currency: 'USD',
      status: 'succeeded',
      paidAt: new Date(periodStart.getTime() + 3600 * 1000)
    }
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({
    email: owner.email,
    password: 'Password123!'
  });
  assert.equal(login.status, 200);
  const accessToken = (login.body as { accessToken: string }).accessToken;

  const agreement = await request(server)
    .post('/billing/partner-settlement/agreements')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      partnerName: `Partner ${suffix}`,
      startsAt: periodStart.toISOString(),
      shareBps: 2000,
      productCategory: 'all'
    });
  assert.equal(agreement.status, 201);
  const agreementId = (agreement.body as { id: string }).id;

  const period = await request(server)
    .post(`/billing/partner-settlement/agreements/${agreementId}/periods`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });
  assert.equal(period.status, 201);
  const periodId = (period.body as { id: string }).id;

  const compute = await request(server)
    .post(`/billing/partner-settlement/periods/${periodId}/compute`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      basis: 'net'
    });
  assert.equal(compute.status, 201);

  const reportAfterCompute = compute.body as { totals: { totalPayableCents: number } };
  assert.equal(reportAfterCompute.totals.totalPayableCents > 0, true);

  const hold = await request(server)
    .patch(`/billing/partner-settlement/periods/${periodId}/status`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      action: 'hold',
      note: 'manual hold for review'
    });
  assert.equal(hold.status, 200);
  assert.equal((hold.body as { status: string }).status, 'on_hold');

  const release = await request(server)
    .patch(`/billing/partner-settlement/periods/${periodId}/status`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      action: 'release'
    });
  assert.equal(release.status, 200);

  const approve = await request(server)
    .patch(`/billing/partner-settlement/periods/${periodId}/status`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      action: 'approve'
    });
  assert.equal(approve.status, 200);

  const pay = await request(server)
    .patch(`/billing/partner-settlement/periods/${periodId}/status`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      action: 'pay',
      payoutReference: `payout-${suffix}`
    });
  assert.equal(pay.status, 200);

  const reconcile = await request(server)
    .patch(`/billing/partner-settlement/periods/${periodId}/status`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      action: 'reconcile'
    });
  assert.equal(reconcile.status, 200);

  const adjustment = await request(server)
    .post(`/billing/partner-settlement/periods/${periodId}/adjustments`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      amountCents: 500,
      reasonCode: 'retro_bonus',
      carryForward: true
    });
  assert.equal(adjustment.status, 201);

  const nextPeriod = await request(server)
    .post(`/billing/partner-settlement/agreements/${agreementId}/periods`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      periodStart: periodEnd.toISOString(),
      periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1)).toISOString()
    });
  assert.equal(nextPeriod.status, 201);
  const nextPeriodId = (nextPeriod.body as { id: string }).id;

  const nextCompute = await request(server)
    .post(`/billing/partner-settlement/periods/${nextPeriodId}/compute`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id
    });
  assert.equal(nextCompute.status, 201);
  const nextReport = nextCompute.body as { totals: { totalAdjustmentsCents: number } };
  assert.equal(nextReport.totals.totalAdjustmentsCents >= 500, true);

  const report = await request(server)
    .get(`/billing/partner-settlement/periods/${periodId}/report`)
    .query({ organizationId: organization.id })
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(report.status, 200);
  const reportBody = report.body as {
    reconciliation: { payoutStatus: string };
  };
  assert.equal(reportBody.reconciliation.payoutStatus, 'paid');

  await app.close();
  process.env = previousEnv;
});
