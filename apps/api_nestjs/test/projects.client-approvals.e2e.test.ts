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

void test('client approval and revision request flow updates project state in both branches', async () => {
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
    data: { name: `Project Approval Org ${suffix}` }
  });

  const user = await prisma.user.create({
    data: {
      email: `project-approval-${suffix}@studioos.dev`,
      firstName: 'Project',
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
      name: 'Approval Client',
      email: 'client@approval.dev'
    }
  });

  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  const loginResponse = await request(httpServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  assert.equal(loginResponse.status, 200);
  const accessToken = (loginResponse.body as AuthTokensResponse).accessToken;

  const createProjectResponse = await request(httpServer)
    .post('/projects')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId: client.id,
      name: 'Client Approval Flow'
    });
  assert.equal(createProjectResponse.status, 201);
  const projectId = (createProjectResponse.body as { id: string }).id;

  const goShoot = await request(httpServer)
    .patch(`/projects/${projectId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'shoot' });
  assert.equal(goShoot.status, 200);

  const goEdit = await request(httpServer)
    .patch(`/projects/${projectId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'edit' });
  assert.equal(goEdit.status, 200);

  const goReview = await request(httpServer)
    .patch(`/projects/${projectId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'review' });
  assert.equal(goReview.status, 200);

  const revisionResponse = await request(httpServer)
    .post(
      `/projects/${projectId}/client-revision?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ comment: 'Please adjust color grading.' });
  assert.equal(revisionResponse.status, 201);
  assert.equal((revisionResponse.body as { status: string }).status, 'edit');
  assert.equal((revisionResponse.body as { revisionCount: number }).revisionCount, 1);
  assert.equal(
    (revisionResponse.body as { clientApprovalState: string }).clientApprovalState,
    'changes_requested'
  );

  const backToReview = await request(httpServer)
    .patch(`/projects/${projectId}/status?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status: 'review' });
  assert.equal(backToReview.status, 200);

  const approvalResponse = await request(httpServer)
    .post(
      `/projects/${projectId}/client-approve?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(approvalResponse.status, 201);
  assert.equal((approvalResponse.body as { status: string }).status, 'delivered');
  assert.equal(
    (approvalResponse.body as { clientApprovalState: string }).clientApprovalState,
    'approved'
  );

  const timelineResponse = await request(httpServer)
    .get(`/projects/${projectId}/timeline?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(timelineResponse.status, 200);

  const timeline = timelineResponse.body as Array<{ action: string }>;
  assert.ok(timeline.some((event) => event.action === 'project.client.revision.requested'));
  assert.ok(timeline.some((event) => event.action === 'project.client.approved'));

  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.project.deleteMany({ where: { organizationId: organization.id } });
  await prisma.client.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
