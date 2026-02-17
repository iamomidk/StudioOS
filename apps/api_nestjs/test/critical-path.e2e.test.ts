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

void test('critical path succeeds and includes failure branches', async () => {
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
  const password = 'Password123!';

  const organization = await prisma.organization.create({
    data: { name: `Critical Org ${suffix}` }
  });
  const user = await prisma.user.create({
    data: {
      email: `critical-${suffix}@studioos.dev`,
      firstName: 'Critical',
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

  const asset = await prisma.asset.create({
    data: {
      organizationId: organization.id,
      name: 'Critical Camera',
      category: 'camera'
    }
  });
  const item = await prisma.inventoryItem.create({
    data: {
      organizationId: organization.id,
      assetId: asset.id,
      serialNumber: `CRIT-${suffix}`,
      condition: 'good'
    }
  });

  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  const loginResponse = await request(httpServer)
    .post('/auth/login')
    .send({ email: user.email, password });
  assert.equal(loginResponse.status, 200);
  const accessToken = (loginResponse.body as AuthTokensResponse).accessToken;

  const leadResponse = await request(httpServer)
    .post('/crm/leads')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ organizationId: organization.id, name: 'Critical Lead', email: 'lead@studioos.dev' });
  assert.equal(leadResponse.status, 201);
  const leadId = (leadResponse.body as { id: string }).id;

  const convertResponse = await request(httpServer)
    .post(`/crm/leads/${leadId}/convert`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ organizationId: organization.id });
  assert.equal(convertResponse.status, 201);
  const clientId = (convertResponse.body as { client: { id: string } }).client.id;

  const quoteResponse = await request(httpServer)
    .post('/crm/quotes')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId,
      title: 'Critical Quote',
      startsAt: '2026-12-01T09:00:00.000Z',
      endsAt: '2026-12-01T12:00:00.000Z',
      items: [{ description: 'Package', quantity: 1, unitPriceCents: 100000 }]
    });
  assert.equal(quoteResponse.status, 201);
  const quoteId = (quoteResponse.body as { id: string }).id;

  const invalidQuoteTransition = await request(httpServer)
    .patch(`/crm/quotes/${quoteId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'accepted' });
  assert.equal(invalidQuoteTransition.status, 400);

  const sendQuote = await request(httpServer)
    .patch(`/crm/quotes/${quoteId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'sent' });
  assert.equal(sendQuote.status, 200);

  const acceptQuote = await request(httpServer)
    .patch(`/crm/quotes/${quoteId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'accepted' });
  assert.equal(acceptQuote.status, 200);
  const bookingId = (acceptQuote.body as { booking: { id: string } }).booking.id;

  const projectResponse = await request(httpServer)
    .post('/projects')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId,
      bookingId,
      name: 'Critical Project'
    });
  assert.equal(projectResponse.status, 201);
  const projectId = (projectResponse.body as { id: string }).id;

  const invalidProjectTransition = await request(httpServer)
    .patch(`/projects/${projectId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'edit' });
  assert.equal(invalidProjectTransition.status, 400);

  for (const status of ['shoot', 'edit', 'review', 'delivered', 'closed']) {
    const transition = await request(httpServer)
      .patch(`/projects/${projectId}/status?organizationId=${encodeURIComponent(organization.id)}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status });
    assert.equal(transition.status, 200);
  }

  const rentalResponse = await request(httpServer)
    .post('/rentals')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      inventoryItemId: item.id,
      clientId,
      startsAt: '2026-12-02T09:00:00.000Z',
      endsAt: '2026-12-02T12:00:00.000Z'
    });
  assert.equal(rentalResponse.status, 201);
  const rentalOrderId = (rentalResponse.body as { id: string }).id;

  const invalidRentalTransition = await request(httpServer)
    .patch(`/rentals/${rentalOrderId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'returned' });
  assert.equal(invalidRentalTransition.status, 400);

  const pickup = await request(httpServer)
    .patch(`/rentals/${rentalOrderId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'picked_up' });
  assert.equal(pickup.status, 200);

  const returned = await request(httpServer)
    .patch(`/rentals/${rentalOrderId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'returned' });
  assert.equal(returned.status, 200);

  const invoiceResponse = await request(httpServer)
    .post('/billing/invoices')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId,
      invoiceNumber: `INV-CRIT-${suffix}`,
      subtotalCents: 100000,
      taxCents: 0
    });
  assert.equal(invoiceResponse.status, 201);
  const invoiceId = (invoiceResponse.body as { id: string }).id;

  const issueInvoice = await request(httpServer)
    .patch(
      `/billing/invoices/${invoiceId}/status?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'issued' });
  assert.equal(issueInvoice.status, 200);

  const paymentPayload = {
    eventId: `evt-critical-${suffix}`,
    type: 'payment.succeeded',
    organizationId: organization.id,
    invoiceId,
    providerRef: `pay-critical-${suffix}`,
    amountCents: 100000,
    currency: 'USD',
    occurredAt: '2026-12-03T12:00:00.000Z'
  };
  const signature = createHmac('sha256', webhookSecret)
    .update(JSON.stringify(paymentPayload))
    .digest('hex');

  const paymentWebhook = await request(httpServer)
    .post('/billing/payments/webhook/demo')
    .set('x-provider-signature', signature)
    .send(paymentPayload);
  assert.equal(paymentWebhook.status, 201);
  assert.equal((paymentWebhook.body as { status: string }).status, 'processed');

  const duplicateWebhook = await request(httpServer)
    .post('/billing/payments/webhook/demo')
    .set('x-provider-signature', signature)
    .send(paymentPayload);
  assert.equal(duplicateWebhook.status, 201);
  assert.equal((duplicateWebhook.body as { status: string }).status, 'duplicate');

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  assert.equal(invoice?.status, 'paid');

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.paymentWebhookEvent.deleteMany({ where: { organizationId: organization.id } });
  await prisma.payment.deleteMany({ where: { organizationId: organization.id } });
  await prisma.invoice.deleteMany({ where: { organizationId: organization.id } });
  await prisma.rentalEvidence.deleteMany({ where: { organizationId: organization.id } });
  await prisma.rentalOrder.deleteMany({ where: { organizationId: organization.id } });
  await prisma.project.deleteMany({ where: { organizationId: organization.id } });
  await prisma.booking.deleteMany({ where: { organizationId: organization.id } });
  await prisma.quote.deleteMany({ where: { organizationId: organization.id } });
  await prisma.client.deleteMany({ where: { organizationId: organization.id } });
  await prisma.lead.deleteMany({ where: { organizationId: organization.id } });
  await prisma.inventoryItem.deleteMany({ where: { organizationId: organization.id } });
  await prisma.asset.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
