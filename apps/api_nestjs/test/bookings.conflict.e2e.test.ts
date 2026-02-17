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

interface ConflictResponseBody {
  error: {
    code: 'BOOKING_CONFLICT';
    conflicts: Array<{
      bookingId: string;
      startsAt: string;
      endsAt: string;
      title: string;
      status: string;
    }>;
    requested: {
      startsAt: string;
      endsAt: string;
    };
  };
}

void test('booking conflict engine handles overlap edge cases and returns structured payload', async () => {
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
    data: { name: `Bookings Org ${suffix}` }
  });

  const user = await prisma.user.create({
    data: {
      email: `bookings-${suffix}@studioos.dev`,
      firstName: 'Bookings',
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
      name: 'Booking Client',
      email: 'client@booking.dev'
    }
  });

  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  const loginResponse = await request(httpServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  assert.equal(loginResponse.status, 200);
  const accessToken = (loginResponse.body as AuthTokensResponse).accessToken;

  const baseBookingResponse = await request(httpServer)
    .post('/bookings')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId: client.id,
      title: 'Base Booking',
      startsAt: '2026-05-01T10:00:00.000Z',
      endsAt: '2026-05-01T12:00:00.000Z'
    });

  assert.equal(baseBookingResponse.status, 201);

  const edgeNonOverlap = await request(httpServer)
    .post('/bookings')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId: client.id,
      title: 'Edge Booking',
      startsAt: '2026-05-01T12:00:00.000Z',
      endsAt: '2026-05-01T13:00:00.000Z'
    });

  assert.equal(edgeNonOverlap.status, 201);

  const overlapConflict = await request(httpServer)
    .post('/bookings')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId: client.id,
      title: 'Conflict Booking',
      startsAt: '2026-05-01T11:30:00.000Z',
      endsAt: '2026-05-01T12:30:00.000Z'
    });

  assert.equal(overlapConflict.status, 409);
  const conflictBody = overlapConflict.body as ConflictResponseBody;
  assert.equal(conflictBody.error.code, 'BOOKING_CONFLICT');
  assert.equal(conflictBody.error.conflicts.length, 2);
  assert.equal(conflictBody.error.requested.startsAt, '2026-05-01T11:30:00.000Z');

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.booking.deleteMany({ where: { organizationId: organization.id } });
  await prisma.client.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
