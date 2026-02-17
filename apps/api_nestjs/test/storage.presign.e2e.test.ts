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
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'test-access-key-id',
  AWS_SECRET_ACCESS_KEY: 'test-secret-access-key',
  S3_BUCKET: 'studioos-media',
  S3_PRESIGN_TTL_SECONDS: '120',
  S3_MAX_UPLOAD_BYTES: '1024',
  S3_ALLOWED_CONTENT_TYPES: 'image/jpeg,application/pdf'
};

interface AuthTokensResponse {
  accessToken: string;
}

interface PresignUploadResponse {
  url: string;
  key: string;
  expiresInSeconds: number;
}

void test('s3 presign endpoints enforce content/size constraints and return signed URLs', async () => {
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
    data: { name: `Storage Org ${suffix}` }
  });
  const user = await prisma.user.create({
    data: {
      email: `storage-${suffix}@studioos.dev`,
      firstName: 'Storage',
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

  const presignUpload = await request(httpServer)
    .post('/storage/presign-upload')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      objectKey: 'uploads/evidence.jpg',
      contentType: 'image/jpeg',
      contentLengthBytes: 800
    });
  assert.equal(presignUpload.status, 201);
  const uploadBody = presignUpload.body as PresignUploadResponse;
  assert.equal(uploadBody.expiresInSeconds, 120);
  assert.equal(uploadBody.key, `${organization.id}/uploads/evidence.jpg`);
  assert.match(uploadBody.url, /X-Amz-Signature=/);

  const disallowedType = await request(httpServer)
    .post('/storage/presign-upload')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      objectKey: 'uploads/evidence.gif',
      contentType: 'image/gif',
      contentLengthBytes: 800
    });
  assert.equal(disallowedType.status, 400);

  const tooLarge = await request(httpServer)
    .post('/storage/presign-upload')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      objectKey: 'uploads/evidence.pdf',
      contentType: 'application/pdf',
      contentLengthBytes: 4096
    });
  assert.equal(tooLarge.status, 400);

  const invalidDownloadScope = await request(httpServer)
    .post('/storage/presign-download')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      objectKey: '../evidence.jpg'
    });
  assert.equal(invalidDownloadScope.status, 400);

  const validDownload = await request(httpServer)
    .post('/storage/presign-download')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      objectKey: 'uploads/evidence.jpg'
    });
  assert.equal(validDownload.status, 201);
  assert.match((validDownload.body as { url: string }).url, /X-Amz-Signature=/);

  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
