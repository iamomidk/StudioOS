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

interface RentalConflictResponse {
  error: {
    code: 'RENTAL_CONFLICT';
    conflicts: Array<{ rentalOrderId: string }>;
  };
}

void test('rental lifecycle rejects invalid transitions and enforces reservation conflicts', async () => {
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
    data: { name: `Rentals Org ${suffix}` }
  });
  const user = await prisma.user.create({
    data: {
      email: `rentals-${suffix}@studioos.dev`,
      firstName: 'Rentals',
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
      name: 'Aputure 600D',
      category: 'light'
    }
  });
  const inventoryItem = await prisma.inventoryItem.create({
    data: {
      organizationId: organization.id,
      assetId: asset.id,
      serialNumber: `LIGHT-${suffix}`,
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

  const createReserved = await request(httpServer)
    .post('/rentals')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      inventoryItemId: inventoryItem.id,
      startsAt: '2026-08-01T09:00:00.000Z',
      endsAt: '2026-08-01T18:00:00.000Z'
    });
  assert.equal(createReserved.status, 201);
  const rentalOrderId = (createReserved.body as { id: string }).id;

  const overlap = await request(httpServer)
    .post('/rentals')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      inventoryItemId: inventoryItem.id,
      startsAt: '2026-08-01T10:00:00.000Z',
      endsAt: '2026-08-01T12:00:00.000Z'
    });
  assert.equal(overlap.status, 409);
  const conflictBody = overlap.body as RentalConflictResponse;
  assert.equal(conflictBody.error.code, 'RENTAL_CONFLICT');
  assert.equal(conflictBody.error.conflicts.length, 1);

  const invalidTransition = await request(httpServer)
    .patch(`/rentals/${rentalOrderId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'returned' });
  assert.equal(invalidTransition.status, 400);

  const pickUp = await request(httpServer)
    .patch(`/rentals/${rentalOrderId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'picked_up' });
  assert.equal(pickUp.status, 200);
  assert.equal((pickUp.body as { status: string }).status, 'picked_up');

  const returned = await request(httpServer)
    .patch(`/rentals/${rentalOrderId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'returned' });
  assert.equal(returned.status, 200);
  assert.equal((returned.body as { status: string }).status, 'returned');

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
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
