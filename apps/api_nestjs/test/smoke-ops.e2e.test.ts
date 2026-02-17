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

const smokeToken = 'smoke-token-for-tests';
const requiredEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
  SMOKE_OPS_ENABLED: 'true',
  SMOKE_CHECK_TOKEN: smokeToken
};

interface AuthTokensResponse {
  accessToken: string;
}

void test('smoke ops endpoints expose heartbeat, queue probe, and cleanup', async () => {
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
    data: { name: `Smoke Ops Org ${suffix}` }
  });

  const user = await prisma.user.create({
    data: {
      email: `smoke-ops-${suffix}@studioos.dev`,
      firstName: 'Smoke',
      lastName: 'Ops',
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

  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  const loginResponse = await request(httpServer)
    .post('/auth/login')
    .send({ email: user.email, password });
  assert.equal(loginResponse.status, 200);
  const accessToken = (loginResponse.body as AuthTokensResponse).accessToken;

  const noToken = await request(httpServer).get('/health/workers');
  assert.equal(noToken.status, 403);

  const workers = await request(httpServer).get('/health/workers').set('x-smoke-token', smokeToken);
  assert.equal(workers.status, 200);
  assert.equal(Array.isArray((workers.body as { workers: unknown[] }).workers), true);

  const queueSmoke = await request(httpServer)
    .post('/health/queue-smoke')
    .set('x-smoke-token', smokeToken)
    .send({ recipientUserId: user.id });
  assert.equal(queueSmoke.status, 201);
  assert.equal((queueSmoke.body as { status: string }).status, 'processed');

  const client = await prisma.client.create({
    data: {
      organizationId: organization.id,
      name: `smoke-client-${suffix}`,
      email: `smoke-client-${suffix}@example.com`
    }
  });
  const lead = await prisma.lead.create({
    data: {
      organizationId: organization.id,
      name: `smoke-lead-${suffix}`,
      email: `smoke-lead-${suffix}@example.com`
    }
  });
  const quote = await prisma.quote.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      title: `smoke-quote-${suffix}`,
      startsAt: new Date(Date.now() + 10_000),
      endsAt: new Date(Date.now() + 20_000),
      subtotalCents: 1000,
      taxCents: 0,
      totalCents: 1000
    }
  });
  const booking = await prisma.booking.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      quoteId: quote.id,
      title: `smoke-booking-${suffix}`,
      startsAt: new Date(Date.now() + 10_000),
      endsAt: new Date(Date.now() + 20_000)
    }
  });
  const asset = await prisma.asset.create({
    data: {
      organizationId: organization.id,
      name: `smoke-asset-${suffix}`,
      category: 'camera'
    }
  });
  const inventoryItem = await prisma.inventoryItem.create({
    data: {
      organizationId: organization.id,
      assetId: asset.id,
      serialNumber: `SMOKE-${suffix}`,
      condition: 'good'
    }
  });
  const rentalOrder = await prisma.rentalOrder.create({
    data: {
      organizationId: organization.id,
      inventoryItemId: inventoryItem.id,
      clientId: client.id,
      startsAt: new Date(Date.now() + 10_000),
      endsAt: new Date(Date.now() + 20_000)
    }
  });
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      invoiceNumber: `SMOKE-${suffix}`,
      subtotalCents: 1000,
      taxCents: 0,
      totalCents: 1000
    }
  });

  const cleanup = await request(httpServer)
    .post('/health/smoke-cleanup')
    .set('x-smoke-token', smokeToken)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      leadId: lead.id,
      clientId: client.id,
      quoteId: quote.id,
      bookingId: booking.id,
      assetId: asset.id,
      inventoryItemId: inventoryItem.id,
      rentalOrderId: rentalOrder.id,
      invoiceId: invoice.id
    });

  assert.equal(cleanup.status, 201);
  assert.equal((cleanup.body as { status: string }).status, 'cleaned');

  assert.equal(await prisma.lead.findUnique({ where: { id: lead.id } }), null);
  assert.equal(await prisma.client.findUnique({ where: { id: client.id } }), null);
  assert.equal(await prisma.quote.findUnique({ where: { id: quote.id } }), null);
  assert.equal(await prisma.booking.findUnique({ where: { id: booking.id } }), null);
  assert.equal(await prisma.asset.findUnique({ where: { id: asset.id } }), null);
  assert.equal(await prisma.inventoryItem.findUnique({ where: { id: inventoryItem.id } }), null);
  assert.equal(await prisma.rentalOrder.findUnique({ where: { id: rentalOrder.id } }), null);
  assert.equal(await prisma.invoice.findUnique({ where: { id: invoice.id } }), null);

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.organization.deleteMany({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
