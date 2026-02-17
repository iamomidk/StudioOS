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

interface EvidencePageResponse {
  items: Array<{ id: string }>;
  nextCursor: string | null;
}

void test('rental evidence is append-only and retrievable with pagination', async () => {
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
    data: { name: `Rental Evidence Org ${suffix}` }
  });
  const user = await prisma.user.create({
    data: {
      email: `rental-evidence-${suffix}@studioos.dev`,
      firstName: 'Rental',
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

  const asset = await prisma.asset.create({
    data: {
      organizationId: organization.id,
      name: 'Sony FX3',
      category: 'camera'
    }
  });
  const inventoryItem = await prisma.inventoryItem.create({
    data: {
      organizationId: organization.id,
      assetId: asset.id,
      serialNumber: `FX3-${suffix}`,
      condition: 'good'
    }
  });

  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  const loginResponse = await request(httpServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  assert.equal(loginResponse.status, 200);
  const accessToken = (loginResponse.body as AuthTokensResponse).accessToken;

  const createRental = await request(httpServer)
    .post('/rentals')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      inventoryItemId: inventoryItem.id,
      startsAt: '2026-09-10T09:00:00.000Z',
      endsAt: '2026-09-10T12:00:00.000Z'
    });
  assert.equal(createRental.status, 201);
  const rentalOrderId = (createRental.body as { id: string }).id;

  const createEvidenceOne = await request(httpServer)
    .post(`/rentals/${rentalOrderId}/evidence`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      photoUrl: 'https://example.com/evidence-1.jpg',
      note: 'Pickup photo',
      occurredAt: '2026-09-10T09:05:00.000Z'
    });
  assert.equal(createEvidenceOne.status, 201);

  const createEvidenceTwo = await request(httpServer)
    .post(`/rentals/${rentalOrderId}/evidence`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      photoUrl: 'https://example.com/evidence-2.jpg',
      note: 'Return photo',
      occurredAt: '2026-09-10T11:55:00.000Z',
      latitude: 37.7749,
      longitude: -122.4194
    });
  assert.equal(createEvidenceTwo.status, 201);
  const secondEvidenceId = (createEvidenceTwo.body as { id: string }).id;

  const pageOne = await request(httpServer)
    .get(
      `/rentals/${rentalOrderId}/evidence?organizationId=${encodeURIComponent(organization.id)}&limit=1`
    )
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(pageOne.status, 200);
  const pageOneBody = pageOne.body as EvidencePageResponse;
  assert.equal(pageOneBody.items.length, 1);
  const nextCursor = pageOneBody.nextCursor;
  assert.ok(nextCursor);
  const cursor = nextCursor ?? '';

  const pageTwo = await request(httpServer)
    .get(
      `/rentals/${rentalOrderId}/evidence?organizationId=${encodeURIComponent(organization.id)}&limit=1&cursor=${encodeURIComponent(cursor)}`
    )
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(pageTwo.status, 200);
  const pageTwoBody = pageTwo.body as EvidencePageResponse;
  assert.equal(pageTwoBody.items.length, 1);

  const overwriteAttempt = await request(httpServer)
    .patch(`/rentals/${rentalOrderId}/evidence/${secondEvidenceId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ note: 'modified' });
  assert.equal(overwriteAttempt.status, 404);

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.rentalEvidence.deleteMany({ where: { organizationId: organization.id } });
  await prisma.rentalOrder.deleteMany({ where: { organizationId: organization.id } });
  await prisma.inventoryItem.deleteMany({ where: { organizationId: organization.id } });
  await prisma.asset.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
