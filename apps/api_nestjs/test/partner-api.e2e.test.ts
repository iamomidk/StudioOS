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

void test('partner API enforces scopes, tenant isolation, and idempotent writes', async () => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
    JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests'
  });

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

  const [orgA, orgB] = await Promise.all([
    prisma.organization.create({ data: { name: `Partner Org A ${suffix}` } }),
    prisma.organization.create({ data: { name: `Partner Org B ${suffix}` } })
  ]);

  const owner = await prisma.user.create({
    data: {
      email: `partner-owner-${suffix}@studioos.dev`,
      firstName: 'Partner',
      lastName: 'Owner',
      passwordHash: await bcrypt.hash(password, 10)
    }
  });

  await prisma.membership.create({
    data: {
      organizationId: orgA.id,
      userId: owner.id,
      role: 'owner'
    }
  });

  const client = await prisma.client.create({
    data: {
      organizationId: orgA.id,
      name: 'Partner Client'
    }
  });

  const asset = await prisma.asset.create({
    data: {
      organizationId: orgA.id,
      name: 'Partner Camera',
      category: 'camera'
    }
  });

  const inventoryItem = await prisma.inventoryItem.create({
    data: {
      organizationId: orgA.id,
      assetId: asset.id,
      serialNumber: `partner-serial-${suffix}`,
      condition: 'good'
    }
  });

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: orgA.id,
      clientId: client.id,
      invoiceNumber: `PARTNER-INV-${suffix}`,
      subtotalCents: 1000,
      taxCents: 100,
      totalCents: 1100,
      status: 'issued'
    }
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];

  const login = await request(server).post('/auth/login').send({
    email: owner.email,
    password
  });
  assert.equal(login.status, 200);
  const token = (login.body as { accessToken: string }).accessToken;

  const createCredential = await request(server)
    .post('/partner/credentials')
    .set('Authorization', `Bearer ${token}`)
    .send({
      organizationId: orgA.id,
      name: 'Partner Integration',
      scopes: [
        'leads:read',
        'leads:write',
        'bookings:read',
        'bookings:write',
        'inventory:read',
        'rentals:read',
        'rentals:write',
        'invoices:read'
      ]
    });

  assert.equal(createCredential.status, 201);
  const apiKey = (createCredential.body as { rawApiKey: string }).rawApiKey;

  const createLead = await request(server)
    .post('/api/partner/v1/leads')
    .set('x-partner-api-key', apiKey)
    .set('idempotency-key', `lead-${suffix}`)
    .send({
      organizationId: orgA.id,
      name: 'Partner Lead',
      email: `lead-${suffix}@example.com`
    });
  assert.equal(createLead.status, 201);
  const leadId = (createLead.body as { id: string }).id;

  const createLeadRetry = await request(server)
    .post('/api/partner/v1/leads')
    .set('x-partner-api-key', apiKey)
    .set('idempotency-key', `lead-${suffix}`)
    .send({
      organizationId: orgA.id,
      name: 'Partner Lead',
      email: `lead-${suffix}@example.com`
    });
  assert.equal(createLeadRetry.status, 201);
  assert.equal((createLeadRetry.body as { id: string }).id, leadId);

  const idempotencyConflict = await request(server)
    .post('/api/partner/v1/leads')
    .set('x-partner-api-key', apiKey)
    .set('idempotency-key', `lead-${suffix}`)
    .send({
      organizationId: orgA.id,
      name: 'Changed Payload'
    });
  assert.equal(idempotencyConflict.status, 409);

  const createBooking = await request(server)
    .post('/api/partner/v1/bookings')
    .set('x-partner-api-key', apiKey)
    .set('idempotency-key', `booking-${suffix}`)
    .send({
      organizationId: orgA.id,
      clientId: client.id,
      title: 'Partner Booking',
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    });
  assert.equal(createBooking.status, 201);

  const createRental = await request(server)
    .post('/api/partner/v1/rentals')
    .set('x-partner-api-key', apiKey)
    .set('idempotency-key', `rental-${suffix}`)
    .send({
      organizationId: orgA.id,
      inventoryItemId: inventoryItem.id,
      clientId: client.id,
      startsAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
    });
  assert.equal(createRental.status, 201);

  const invoiceStatus = await request(server)
    .get(
      `/api/partner/v1/invoices/${encodeURIComponent(invoice.id)}?organizationId=${encodeURIComponent(orgA.id)}`
    )
    .set('x-partner-api-key', apiKey);
  assert.equal(invoiceStatus.status, 200);
  assert.equal((invoiceStatus.body as { status: string }).status, 'issued');

  const tenantMismatch = await request(server)
    .get(`/api/partner/v1/leads?organizationId=${encodeURIComponent(orgB.id)}`)
    .set('x-partner-api-key', apiKey);
  assert.equal(tenantMismatch.status, 403);

  const readOnlyCredential = await request(server)
    .post('/partner/credentials')
    .set('Authorization', `Bearer ${token}`)
    .send({
      organizationId: orgA.id,
      name: 'Partner Readonly',
      scopes: ['leads:read']
    });

  assert.equal(readOnlyCredential.status, 201);
  const readOnlyKey = (readOnlyCredential.body as { rawApiKey: string }).rawApiKey;

  const missingScope = await request(server)
    .post('/api/partner/v1/leads')
    .set('x-partner-api-key', readOnlyKey)
    .set('idempotency-key', `readonly-${suffix}`)
    .send({
      organizationId: orgA.id,
      name: 'Unauthorized Lead'
    });
  assert.equal(missingScope.status, 403);

  const tightQuotaCredential = await request(server)
    .post('/partner/credentials')
    .set('Authorization', `Bearer ${token}`)
    .send({
      organizationId: orgA.id,
      name: 'Partner Tight Quota',
      scopes: ['leads:read'],
      requestsPerMinute: 1,
      dailyQuota: 1
    });

  assert.equal(tightQuotaCredential.status, 201);
  const tightQuotaKey = (tightQuotaCredential.body as { rawApiKey: string }).rawApiKey;

  const firstQuotaRead = await request(server)
    .get(`/api/partner/v1/leads?organizationId=${encodeURIComponent(orgA.id)}`)
    .set('x-partner-api-key', tightQuotaKey);
  assert.equal(firstQuotaRead.status, 200);

  const secondQuotaRead = await request(server)
    .get(`/api/partner/v1/leads?organizationId=${encodeURIComponent(orgA.id)}`)
    .set('x-partner-api-key', tightQuotaKey);
  assert.equal(secondQuotaRead.status, 429);

  const dashboard = await request(server)
    .get(`/partner/credentials/usage/dashboard?organizationId=${encodeURIComponent(orgA.id)}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(dashboard.status, 200);
  assert.equal((dashboard.body as { requests: number }).requests > 0, true);

  await prisma.partnerApiIdempotencyRecord.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.partnerApiRequestLog.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.partnerApiCredential.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.payment.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.invoice.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.rentalOrder.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.inventoryItem.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.asset.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.booking.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.lead.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.client.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.membership.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.refreshToken.deleteMany({ where: { userId: owner.id } });
  await prisma.user.deleteMany({ where: { id: owner.id } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });

  await app.close();
  process.env = previousEnv;
});
