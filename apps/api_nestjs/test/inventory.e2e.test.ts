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

void test('inventory domain supports asset/item CRUD search and rejects duplicate serial per org', async () => {
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
    data: { name: `Inventory Org ${suffix}` }
  });

  const user = await prisma.user.create({
    data: {
      email: `inventory-${suffix}@studioos.dev`,
      firstName: 'Inventory',
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

  const createAsset = await request(httpServer)
    .post('/inventory/assets')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      name: 'Canon C70',
      category: 'camera'
    });
  assert.equal(createAsset.status, 201);
  const assetId = (createAsset.body as { id: string }).id;

  const createItem = await request(httpServer)
    .post('/inventory/items')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      assetId,
      serialNumber: 'SERIAL-001',
      condition: 'good',
      ownerName: 'Studio'
    });
  assert.equal(createItem.status, 201);

  const duplicate = await request(httpServer)
    .post('/inventory/items')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      assetId,
      serialNumber: 'SERIAL-001',
      condition: 'excellent',
      ownerName: 'Studio'
    });
  assert.equal(duplicate.status, 409);

  const listAssets = await request(httpServer)
    .get(`/inventory/assets?organizationId=${encodeURIComponent(organization.id)}&search=canon`)
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(listAssets.status, 200);
  assert.equal((listAssets.body as Array<unknown>).length, 1);

  const listItems = await request(httpServer)
    .get(
      `/inventory/items?organizationId=${encodeURIComponent(organization.id)}&condition=good&search=SERIAL-001`
    )
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(listItems.status, 200);
  assert.equal((listItems.body as Array<unknown>).length, 1);

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.inventoryItem.deleteMany({ where: { organizationId: organization.id } });
  await prisma.asset.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
