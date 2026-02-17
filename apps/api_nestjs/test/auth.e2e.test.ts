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
  refreshToken: string;
}

interface ProfileResponse {
  email: string;
}

void test('auth login/refresh/logout flow rotates refresh token and invalidates old token', async () => {
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
  const email = `auth-${Date.now()}@studioos.dev`;
  const password = 'Password123!';

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      firstName: 'Auth',
      lastName: 'Tester',
      passwordHash
    }
  });

  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

  const loginResponse = await request(httpServer).post('/auth/login').send({
    email,
    password
  });

  assert.equal(loginResponse.status, 200);
  const loginBody = loginResponse.body as AuthTokensResponse;
  assert.equal(typeof loginBody.accessToken, 'string');
  assert.equal(typeof loginBody.refreshToken, 'string');

  const firstRefreshToken = loginBody.refreshToken;
  const accessToken = loginBody.accessToken;

  const profileResponse = await request(httpServer)
    .get('/auth/profile')
    .set('Authorization', `Bearer ${accessToken}`);

  assert.equal(profileResponse.status, 200);
  assert.equal((profileResponse.body as ProfileResponse).email, email);

  const refreshResponse = await request(httpServer).post('/auth/refresh').send({
    refreshToken: firstRefreshToken
  });

  assert.equal(refreshResponse.status, 200);
  const refreshBody = refreshResponse.body as AuthTokensResponse;
  assert.equal(typeof refreshBody.refreshToken, 'string');
  const rotatedRefreshToken = refreshBody.refreshToken;
  assert.notEqual(rotatedRefreshToken, firstRefreshToken);

  const reusedResponse = await request(httpServer).post('/auth/refresh').send({
    refreshToken: firstRefreshToken
  });

  assert.equal(reusedResponse.status, 401);

  const logoutResponse = await request(httpServer).post('/auth/logout').send({
    refreshToken: rotatedRefreshToken
  });

  assert.equal(logoutResponse.status, 204);

  const postLogoutRefresh = await request(httpServer).post('/auth/refresh').send({
    refreshToken: rotatedRefreshToken
  });

  assert.equal(postLogoutRefresh.status, 401);

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  await app.close();
  process.env = previousEnv;
});
