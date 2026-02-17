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

interface AuthTokensResponse {
  accessToken: string;
}

void test('invoice lifecycle enforces transitions and snapshots totals after issue', async () => {
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
    data: { name: `Billing Org ${suffix}` }
  });
  const user = await prisma.user.create({
    data: {
      email: `billing-${suffix}@studioos.dev`,
      firstName: 'Billing',
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
      name: 'Billing Client',
      email: 'client@billing.dev'
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
      invoiceNumber: `INV-${suffix}`,
      subtotalCents: 100000,
      taxCents: 10000,
      dueAt: '2026-10-01T00:00:00.000Z'
    });
  assert.equal(createInvoice.status, 201);
  const invoiceId = (createInvoice.body as { id: string }).id;

  const updateDraftTotals = await request(httpServer)
    .patch(
      `/billing/invoices/${invoiceId}/totals?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      subtotalCents: 120000,
      taxCents: 12000
    });
  assert.equal(updateDraftTotals.status, 200);
  assert.equal((updateDraftTotals.body as { totalCents: number }).totalCents, 132000);

  const issueInvoice = await request(httpServer)
    .patch(
      `/billing/invoices/${invoiceId}/status?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'issued' });
  assert.equal(issueInvoice.status, 200);
  assert.equal((issueInvoice.body as { status: string }).status, 'issued');

  const mutateAfterIssue = await request(httpServer)
    .patch(
      `/billing/invoices/${invoiceId}/totals?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      subtotalCents: 1,
      taxCents: 0
    });
  assert.equal(mutateAfterIssue.status, 400);

  const invalidTransition = await request(httpServer)
    .patch(
      `/billing/invoices/${invoiceId}/status?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'draft' });
  assert.equal(invalidTransition.status, 400);

  const partiallyPaid = await request(httpServer)
    .patch(
      `/billing/invoices/${invoiceId}/status?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'partially_paid' });
  assert.equal(partiallyPaid.status, 200);

  const paid = await request(httpServer)
    .patch(
      `/billing/invoices/${invoiceId}/status?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'paid' });
  assert.equal(paid.status, 200);
  assert.equal((paid.body as { status: string }).status, 'paid');

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
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
