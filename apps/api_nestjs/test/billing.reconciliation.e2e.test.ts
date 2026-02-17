import assert from 'node:assert/strict';
import test from 'node:test';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReconciliationDiscrepancyType } from '@prisma/client';
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
  PAYMENT_WEBHOOK_DEMO_SECRET: 'webhook-secret-for-tests',
  RECONCILIATION_DAILY_TOKEN: 'reconciliation-token-for-tests'
};

void test('billing reconciliation identifies discrepancy types and supports resolution workflow', async () => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, requiredEnv);

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
    data: { name: `Reconciliation Org ${suffix}` }
  });
  const user = await prisma.user.create({
    data: {
      email: `reconciliation-${suffix}@studioos.dev`,
      firstName: 'Reconcile',
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
  const client = await prisma.client.create({
    data: {
      organizationId: organization.id,
      name: 'Recon Client',
      email: 'recon-client@studioos.dev'
    }
  });

  const makeInvoice = async (invoiceNumber: string) =>
    prisma.invoice.create({
      data: {
        organizationId: organization.id,
        clientId: client.id,
        invoiceNumber,
        subtotalCents: 10000,
        taxCents: 0,
        totalCents: 10000,
        status: 'issued'
      }
    });

  const matchedInvoice = await makeInvoice(`INV-MATCH-${suffix}`);
  const missingProviderInvoice = await makeInvoice(`INV-MISSING-PROVIDER-${suffix}`);
  const missingInternalInvoice = await makeInvoice(`INV-MISSING-INTERNAL-${suffix}`);
  const amountMismatchInvoice = await makeInvoice(`INV-AMOUNT-MISMATCH-${suffix}`);
  const currencyMismatchInvoice = await makeInvoice(`INV-CURRENCY-MISMATCH-${suffix}`);
  const statusMismatchInvoice = await makeInvoice(`INV-STATUS-MISMATCH-${suffix}`);
  const duplicateInvoice = await makeInvoice(`INV-DUPLICATE-${suffix}`);
  const refundInvoice = await makeInvoice(`INV-REFUND-${suffix}`);

  const now = new Date();

  const matchedPayment = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      invoiceId: matchedInvoice.id,
      provider: 'demo',
      providerRef: `match-${suffix}`,
      amountCents: 5000,
      currency: 'USD',
      status: 'succeeded',
      paidAt: now
    }
  });

  await prisma.payment.create({
    data: {
      organizationId: organization.id,
      invoiceId: missingProviderInvoice.id,
      provider: 'demo',
      providerRef: `missing-provider-${suffix}`,
      amountCents: 3000,
      currency: 'USD',
      status: 'succeeded',
      paidAt: now
    }
  });

  const amountMismatchPayment = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      invoiceId: amountMismatchInvoice.id,
      provider: 'demo',
      providerRef: `amount-mismatch-${suffix}`,
      amountCents: 4000,
      currency: 'USD',
      status: 'succeeded',
      paidAt: now
    }
  });

  const currencyMismatchPayment = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      invoiceId: currencyMismatchInvoice.id,
      provider: 'demo',
      providerRef: `currency-mismatch-${suffix}`,
      amountCents: 4500,
      currency: 'USD',
      status: 'succeeded',
      paidAt: now
    }
  });

  const statusMismatchPayment = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      invoiceId: statusMismatchInvoice.id,
      provider: 'demo',
      providerRef: `status-mismatch-${suffix}`,
      amountCents: 3500,
      currency: 'USD',
      status: 'failed',
      paidAt: null
    }
  });

  const duplicatePaymentA = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      invoiceId: duplicateInvoice.id,
      provider: 'demo',
      providerRef: `duplicate-${suffix}`,
      amountCents: 2000,
      currency: 'USD',
      status: 'succeeded',
      paidAt: now
    }
  });
  await prisma.payment.create({
    data: {
      organizationId: organization.id,
      invoiceId: duplicateInvoice.id,
      provider: 'demo',
      providerRef: `duplicate-${suffix}`,
      amountCents: 2000,
      currency: 'USD',
      status: 'succeeded',
      paidAt: now
    }
  });

  const refundPayment = await prisma.payment.create({
    data: {
      organizationId: organization.id,
      invoiceId: refundInvoice.id,
      provider: 'demo',
      providerRef: `refund-${suffix}`,
      amountCents: 1200,
      currency: 'USD',
      status: 'refunded',
      paidAt: now
    }
  });

  const providerPayload = (
    type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded',
    amountCents: number,
    currency: string,
    providerRef: string
  ) => ({
    eventId: `evt-${type}-${providerRef}`,
    type,
    organizationId: organization.id,
    amountCents,
    currency,
    providerRef
  });

  await prisma.paymentWebhookEvent.createMany({
    data: [
      {
        provider: 'demo',
        eventId: `evt-match-${suffix}`,
        organizationId: organization.id,
        invoiceId: matchedInvoice.id,
        paymentId: matchedPayment.id,
        payload: providerPayload('payment.succeeded', 5000, 'USD', `match-${suffix}`)
      },
      {
        provider: 'demo',
        eventId: `evt-missing-internal-${suffix}`,
        organizationId: organization.id,
        invoiceId: missingInternalInvoice.id,
        paymentId: null,
        payload: providerPayload('payment.succeeded', 1000, 'USD', `missing-internal-${suffix}`)
      },
      {
        provider: 'demo',
        eventId: `evt-amount-mismatch-${suffix}`,
        organizationId: organization.id,
        invoiceId: amountMismatchInvoice.id,
        paymentId: amountMismatchPayment.id,
        payload: providerPayload('payment.succeeded', 7000, 'USD', `amount-mismatch-${suffix}`)
      },
      {
        provider: 'demo',
        eventId: `evt-currency-mismatch-${suffix}`,
        organizationId: organization.id,
        invoiceId: currencyMismatchInvoice.id,
        paymentId: currencyMismatchPayment.id,
        payload: providerPayload('payment.succeeded', 4500, 'EUR', `currency-mismatch-${suffix}`)
      },
      {
        provider: 'demo',
        eventId: `evt-status-mismatch-${suffix}`,
        organizationId: organization.id,
        invoiceId: statusMismatchInvoice.id,
        paymentId: statusMismatchPayment.id,
        payload: providerPayload('payment.succeeded', 3500, 'USD', `status-mismatch-${suffix}`)
      },
      {
        provider: 'demo',
        eventId: `evt-duplicate-${suffix}`,
        organizationId: organization.id,
        invoiceId: duplicateInvoice.id,
        paymentId: duplicatePaymentA.id,
        payload: providerPayload('payment.succeeded', 2000, 'USD', `duplicate-${suffix}`)
      },
      {
        provider: 'demo',
        eventId: `evt-refund-${suffix}`,
        organizationId: organization.id,
        invoiceId: refundInvoice.id,
        paymentId: refundPayment.id,
        payload: providerPayload('payment.refunded', 1200, 'USD', `refund-${suffix}`)
      }
    ]
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const loginResponse = await request(server).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  assert.equal(loginResponse.status, 200);
  const accessToken = (loginResponse.body as { accessToken: string }).accessToken;

  const trigger = await request(server)
    .post('/billing/reconciliation/runs/trigger')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      periodStart: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      periodEnd: new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    });
  assert.equal(trigger.status, 201);

  const runId = (trigger.body as { id: string }).id;
  const report = await request(server)
    .get(
      `/billing/reconciliation/runs/${runId}/report?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(report.status, 200);
  assert.ok((report.body as { reportMarkdown?: string }).reportMarkdown);

  const discrepanciesResponse = await request(server)
    .get(
      `/billing/reconciliation/discrepancies?organizationId=${encodeURIComponent(organization.id)}&runId=${encodeURIComponent(runId)}`
    )
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(discrepanciesResponse.status, 200);

  const discrepancies = discrepanciesResponse.body as Array<{
    id: string;
    type: ReconciliationDiscrepancyType;
  }>;
  const discrepancyTypes = new Set(discrepancies.map((discrepancy) => discrepancy.type));

  assert.equal(discrepancyTypes.has('MissingInternalRecord'), true);
  assert.equal(discrepancyTypes.has('MissingProviderRecord'), true);
  assert.equal(discrepancyTypes.has('AmountMismatch'), true);
  assert.equal(discrepancyTypes.has('CurrencyMismatch'), true);
  assert.equal(discrepancyTypes.has('StatusMismatch'), true);
  assert.equal(discrepancyTypes.has('DuplicateChargeSuspected'), true);

  const firstDiscrepancyId = discrepancies[0]?.id;
  assert.ok(firstDiscrepancyId);

  const acknowledge = await request(server)
    .patch(
      `/billing/reconciliation/discrepancies/${firstDiscrepancyId}/acknowledge?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({});
  assert.equal(acknowledge.status, 200);

  const assign = await request(server)
    .patch(
      `/billing/reconciliation/discrepancies/${firstDiscrepancyId}/assign?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ ownerUserId: user.id, note: 'Finance owner assigned' });
  assert.equal(assign.status, 200);

  const note = await request(server)
    .post(
      `/billing/reconciliation/discrepancies/${firstDiscrepancyId}/notes?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ note: 'Investigated payment timeline' });
  assert.equal(note.status, 201);

  const resolve = await request(server)
    .patch(
      `/billing/reconciliation/discrepancies/${firstDiscrepancyId}/resolve?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ resolutionReason: 'Applied manual adjustment entry', note: 'Closing discrepancy' });
  assert.equal(resolve.status, 200);

  const discrepancyAfterResolve = await prisma.reconciliationDiscrepancy.findUnique({
    where: { id: firstDiscrepancyId }
  });
  assert.equal(discrepancyAfterResolve?.status, 'resolved');

  const actionLogs = await prisma.reconciliationActionLog.findMany({
    where: {
      discrepancyId: firstDiscrepancyId
    }
  });
  assert.equal(actionLogs.length >= 4, true);

  const dailyRun = await request(server)
    .post('/billing/reconciliation/runs/daily')
    .set('x-reconciliation-token', requiredEnv.RECONCILIATION_DAILY_TOKEN)
    .send({ organizationId: organization.id });
  assert.equal(dailyRun.status, 201);
  assert.equal((dailyRun.body as { runsCreated: number }).runsCreated, 1);

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.reconciliationActionLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.reconciliationDiscrepancy.deleteMany({ where: { organizationId: organization.id } });
  await prisma.reconciliationItem.deleteMany({ where: { organizationId: organization.id } });
  await prisma.reconciliationRun.deleteMany({ where: { organizationId: organization.id } });
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
