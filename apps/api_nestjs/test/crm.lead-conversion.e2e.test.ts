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

interface LeadResponse {
  id: string;
  status: string;
}

interface ConvertResponse {
  lead: LeadResponse;
}

void test('lead CRUD + conversion creates client and audit trail', async () => {
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
    data: { name: `CRM Org ${suffix}` }
  });

  const user = await prisma.user.create({
    data: {
      email: `crm-${suffix}@studioos.dev`,
      firstName: 'CRM',
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

  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  const loginResponse = await request(httpServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  assert.equal(loginResponse.status, 200);
  const accessToken = (loginResponse.body as AuthTokensResponse).accessToken;

  const createLeadResponse = await request(httpServer)
    .post('/crm/leads')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      name: 'Acme Prospect',
      email: 'lead@acme.studio'
    });

  assert.equal(createLeadResponse.status, 201);
  const lead = createLeadResponse.body as LeadResponse;
  assert.equal(lead.status, 'new');

  const convertResponse = await request(httpServer)
    .post(`/crm/leads/${lead.id}/convert`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ organizationId: organization.id });

  assert.equal(convertResponse.status, 201);
  assert.equal((convertResponse.body as ConvertResponse).lead.status, 'converted');

  const listResponse = await request(httpServer)
    .get(`/crm/leads?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`);

  assert.equal(listResponse.status, 200);
  const listed = listResponse.body as LeadResponse[];
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.status, 'converted');

  const convertedClient = await prisma.client.findFirst({
    where: {
      organizationId: organization.id,
      email: 'lead@acme.studio'
    }
  });
  assert.ok(convertedClient);

  const conversionAudit = await prisma.auditLog.findFirst({
    where: {
      organizationId: organization.id,
      entityType: 'Lead',
      entityId: lead.id,
      action: 'lead.converted'
    }
  });
  assert.ok(conversionAudit);

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.client.deleteMany({ where: { organizationId: organization.id } });
  await prisma.lead.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
