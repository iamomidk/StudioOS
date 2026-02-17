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

interface AuditLogListResponse {
  items: Array<{ entityType: string }>;
  nextCursor: string | null;
}

void test('audit log query is role-protected and supports entity/time filtering', async () => {
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
    data: { name: `Audit Org ${suffix}` }
  });

  const ownerUser = await prisma.user.create({
    data: {
      email: `audit-owner-${suffix}@studioos.dev`,
      firstName: 'Audit',
      lastName: 'Owner',
      passwordHash
    }
  });
  const shooterUser = await prisma.user.create({
    data: {
      email: `audit-shooter-${suffix}@studioos.dev`,
      firstName: 'Audit',
      lastName: 'Shooter',
      passwordHash
    }
  });

  await prisma.membership.createMany({
    data: [
      {
        organizationId: organization.id,
        userId: ownerUser.id,
        role: 'owner'
      },
      {
        organizationId: organization.id,
        userId: shooterUser.id,
        role: 'shooter'
      }
    ]
  });

  const targetEntityId = `booking-${suffix}`;
  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: organization.id,
        actorUserId: ownerUser.id,
        entityType: 'Booking',
        entityId: targetEntityId,
        action: 'booking.created',
        metadata: { source: 'test' }
      },
      {
        organizationId: organization.id,
        actorUserId: ownerUser.id,
        entityType: 'Invoice',
        entityId: `invoice-${suffix}`,
        action: 'invoice.issued',
        metadata: { source: 'test' }
      }
    ]
  });

  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  const ownerLogin = await request(httpServer).post('/auth/login').send({
    email: ownerUser.email,
    password: 'Password123!'
  });
  assert.equal(ownerLogin.status, 200);
  const ownerAccessToken = (ownerLogin.body as AuthTokensResponse).accessToken;

  const shooterLogin = await request(httpServer).post('/auth/login').send({
    email: shooterUser.email,
    password: 'Password123!'
  });
  assert.equal(shooterLogin.status, 200);
  const shooterAccessToken = (shooterLogin.body as AuthTokensResponse).accessToken;

  const denied = await request(httpServer)
    .get(`/audit/logs?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${shooterAccessToken}`);
  assert.equal(denied.status, 403);

  const fromIso = new Date(Date.now() - 60_000).toISOString();
  const toIso = new Date(Date.now() + 60_000).toISOString();
  const allowed = await request(httpServer)
    .get(
      `/audit/logs?organizationId=${encodeURIComponent(organization.id)}&entityType=Booking&entityId=${encodeURIComponent(targetEntityId)}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&limit=10`
    )
    .set('Authorization', `Bearer ${ownerAccessToken}`);
  assert.equal(allowed.status, 200);
  const allowedBody = allowed.body as AuditLogListResponse;
  assert.equal(allowedBody.items.length, 1);
  assert.equal(allowedBody.items[0]?.entityType, 'Booking');

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({
    where: { userId: { in: [ownerUser.id, shooterUser.id] } }
  });
  await prisma.user.deleteMany({ where: { id: { in: [ownerUser.id, shooterUser.id] } } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
