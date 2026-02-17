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

void test('quote status transitions enforce rules and acceptance creates booking draft', async () => {
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
    data: { name: `Quotes Org ${suffix}` }
  });

  const user = await prisma.user.create({
    data: {
      email: `quotes-${suffix}@studioos.dev`,
      firstName: 'Quotes',
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
      name: 'Quote Client',
      email: 'client@quote.dev'
    }
  });

  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  const loginResponse = await request(httpServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  assert.equal(loginResponse.status, 200);
  const accessToken = (loginResponse.body as AuthTokensResponse).accessToken;

  const createQuoteResponse = await request(httpServer)
    .post('/crm/quotes')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId: client.id,
      title: 'Wedding Package',
      startsAt: '2026-04-10T09:00:00.000Z',
      endsAt: '2026-04-10T18:00:00.000Z',
      items: [
        { description: 'Coverage', quantity: 1, unitPriceCents: 150000 },
        { description: 'Editing', quantity: 1, unitPriceCents: 50000 }
      ]
    });

  assert.equal(createQuoteResponse.status, 201);
  const quoteId = (createQuoteResponse.body as { id: string }).id;

  const invalidTransition = await request(httpServer)
    .patch(`/crm/quotes/${quoteId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'accepted' });

  assert.equal(invalidTransition.status, 400);

  const sendResponse = await request(httpServer)
    .patch(`/crm/quotes/${quoteId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'sent' });

  assert.equal(sendResponse.status, 200);
  assert.equal((sendResponse.body as { status: string }).status, 'sent');

  const acceptResponse = await request(httpServer)
    .patch(`/crm/quotes/${quoteId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'accepted' });

  assert.equal(acceptResponse.status, 200);
  assert.equal((acceptResponse.body as { status: string }).status, 'accepted');

  const booking = await prisma.booking.findFirst({ where: { quoteId } });
  assert.ok(booking);
  assert.equal(booking?.status, 'draft');

  const quoteIds = (
    await prisma.quote.findMany({
      where: { organizationId: organization.id },
      select: { id: true }
    })
  ).map((quote) => quote.id);

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.booking.deleteMany({ where: { organizationId: organization.id } });
  await prisma.quoteLineItem.deleteMany({ where: { quoteId: { in: quoteIds } } });
  await prisma.quote.deleteMany({ where: { organizationId: organization.id } });
  await prisma.client.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
