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
import { Role } from '../src/modules/auth/rbac/role.enum.js';

const requiredEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests'
};

interface LoginResponseBody {
  accessToken: string;
}

const endpointPolicy: Record<string, readonly Role[]> = {
  '/rbac-probe/org-manage': [Role.Owner, Role.Manager],
  '/rbac-probe/shoot': [Role.Owner, Role.Manager, Role.Shooter],
  '/rbac-probe/edit': [Role.Owner, Role.Manager, Role.Editor],
  '/rbac-probe/rental-manage': [Role.Owner, Role.Manager, Role.Renter],
  '/rbac-probe/client-portal': [Role.Client]
};

void test('rbac probe endpoints enforce allow/deny by role', async () => {
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
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);
  const suffix = Date.now().toString();
  const organization = await prisma.organization.create({
    data: { name: `RBAC Org ${suffix}` }
  });

  const roleToToken = new Map<Role, string>();
  const createdUserIds: string[] = [];

  const loginAndGetAccessToken = async (email: string): Promise<string> => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/auth/login')
      .send({ email, password });
    assert.equal(response.status, 200);
    return (response.body as LoginResponseBody).accessToken;
  };

  for (const role of Object.values(Role)) {
    const user = await prisma.user.create({
      data: {
        email: `${role}-${suffix}@studioos.dev`,
        firstName: role,
        lastName: 'Tester',
        passwordHash
      }
    });
    createdUserIds.push(user.id);

    await prisma.membership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role
      }
    });

    roleToToken.set(role, await loginAndGetAccessToken(user.email));
  }

  for (const [endpoint, allowedRoles] of Object.entries(endpointPolicy)) {
    for (const role of Object.values(Role)) {
      const token = roleToToken.get(role);
      assert.ok(token);

      const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
        .get(endpoint)
        .set('Authorization', `Bearer ${token}`);

      const expectedStatus = allowedRoles.includes(role) ? 200 : 403;
      assert.equal(response.status, expectedStatus, `${role} on ${endpoint}`);
    }
  }

  await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.organization.delete({ where: { id: organization.id } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });

  await app.close();
  process.env = previousEnv;
});
