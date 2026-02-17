import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { RequestLoggingInterceptor } from '../src/common/interceptors/request-logging.interceptor.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

const webhookSecret = 'webhook-secret-for-tests';
const requiredEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
  PAYMENT_WEBHOOK_DEMO_SECRET: webhookSecret
};

interface AuthTokensResponse {
  accessToken: string;
}

void test('duplicate payment webhook does not double-apply payment', async () => {
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
    data: { name: `Webhook Org ${suffix}` }
  });
  const user = await prisma.user.create({
    data: {
      email: `webhook-${suffix}@studioos.dev`,
      firstName: 'Webhook',
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
      name: 'Webhook Client'
    }
  });

  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  const loginResponse = await request(httpServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  assert.equal(loginResponse.status, 200);
  const accessToken = (loginResponse.body as AuthTokensResponse).accessToken;

  const createInvoice = await request(httpServer)
    .post('/billing/invoices')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId: client.id,
      invoiceNumber: `INV-WH-${suffix}`,
      subtotalCents: 10000,
      taxCents: 0
    });
  assert.equal(createInvoice.status, 201);
  const invoiceId = (createInvoice.body as { id: string }).id;

  const issueInvoice = await request(httpServer)
    .patch(
      `/billing/invoices/${invoiceId}/status?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'issued' });
  assert.equal(issueInvoice.status, 200);

  const payload = {
    eventId: `evt-${suffix}`,
    type: 'payment.succeeded',
    organizationId: organization.id,
    invoiceId,
    providerRef: `pay-${suffix}`,
    amountCents: 6000,
    currency: 'USD',
    occurredAt: '2026-11-01T10:00:00.000Z'
  };
  const payloadString = JSON.stringify(payload);
  const signature = createHmac('sha256', webhookSecret).update(payloadString).digest('hex');

  const firstDelivery = await request(httpServer)
    .post('/billing/payments/webhook/demo')
    .set('x-provider-signature', signature)
    .send(payload);
  assert.equal(firstDelivery.status, 201);
  assert.equal((firstDelivery.body as { status: string }).status, 'processed');

  const duplicateDelivery = await request(httpServer)
    .post('/billing/payments/webhook/demo')
    .set('x-provider-signature', signature)
    .send(payload);
  assert.equal(duplicateDelivery.status, 201);
  assert.equal((duplicateDelivery.body as { status: string }).status, 'duplicate');

  const payments = await prisma.payment.findMany({
    where: { invoiceId }
  });
  assert.equal(payments.length, 1);
  assert.equal(payments[0]?.amountCents, 6000);
  assert.equal(payments[0]?.status, 'succeeded');

  const webhookEvents = await prisma.paymentWebhookEvent.findMany({
    where: { invoiceId }
  });
  assert.equal(webhookEvents.length, 1);

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  assert.equal(invoice?.status, 'partially_paid');

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
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
