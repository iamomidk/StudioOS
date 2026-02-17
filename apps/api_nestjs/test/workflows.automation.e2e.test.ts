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

void test('workflow automation supports validate publish dry-run execution and loop prevention', async () => {
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
    data: { name: `Workflow Org ${suffix}` }
  });
  const user = await prisma.user.create({
    data: {
      email: `workflow-${suffix}@studioos.dev`,
      firstName: 'Workflow',
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

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  assert.equal(login.status, 200);
  const token = (login.body as { accessToken: string }).accessToken;

  const create = await request(server)
    .post('/automation/workflows')
    .set('Authorization', `Bearer ${token}`)
    .send({
      organizationId: organization.id,
      name: 'Lead high-priority workflow',
      description: 'Auto label and enqueue on high-priority lead',
      maxExecutionsPerHour: 1,
      trigger: {
        eventType: 'lead_created',
        source: 'api'
      },
      conditionGroup: {
        operator: 'AND',
        conditions: [
          {
            field: 'priority',
            op: 'eq',
            value: 'high'
          }
        ]
      },
      actions: [
        {
          actionType: 'apply_label',
          orderIndex: 0,
          config: { label: 'workflow-high-priority' }
        },
        {
          actionType: 'enqueue_job',
          orderIndex: 1,
          config: {
            queue: 'notifications',
            template: 'workflow-lead-created',
            recipientUserId: user.id
          }
        }
      ]
    });
  assert.equal(create.status, 201);
  const workflowId = (create.body as { id: string }).id;

  const validate = await request(server)
    .post(`/automation/workflows/${workflowId}/validate`)
    .set('Authorization', `Bearer ${token}`)
    .send({ organizationId: organization.id });
  assert.equal(validate.status, 201);
  assert.equal((validate.body as { valid: boolean }).valid, true);

  const publish = await request(server)
    .post(`/automation/workflows/${workflowId}/publish`)
    .set('Authorization', `Bearer ${token}`)
    .send({ organizationId: organization.id });
  assert.equal(publish.status, 201);
  assert.equal((publish.body as { status: string }).status, 'published');

  const dryRun = await request(server)
    .post(`/automation/workflows/${workflowId}/dry-run`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      organizationId: organization.id,
      triggerInput: {
        entityId: 'lead-1',
        priority: 'high'
      }
    });
  assert.equal(dryRun.status, 201);
  assert.equal((dryRun.body as { matched: boolean }).matched, true);
  assert.equal((dryRun.body as { predictedActionCount: number }).predictedActionCount, 2);

  const execute = await request(server)
    .post('/automation/workflows/events/trigger')
    .set('Authorization', `Bearer ${token}`)
    .send({
      organizationId: organization.id,
      eventType: 'lead_created',
      entityType: 'Lead',
      entityId: 'lead-1',
      payload: {
        priority: 'high'
      }
    });
  assert.equal(execute.status, 201);
  const firstRun = execute.body as { executedWorkflows: Array<{ status: string }> };
  assert.ok(firstRun.executedWorkflows.some((item) => item.status === 'success'));

  const executeLoopBlocked = await request(server)
    .post('/automation/workflows/events/trigger')
    .set('Authorization', `Bearer ${token}`)
    .send({
      organizationId: organization.id,
      eventType: 'lead_created',
      entityType: 'Lead',
      entityId: 'lead-1',
      payload: {
        priority: 'high'
      }
    });
  assert.equal(executeLoopBlocked.status, 201);
  const secondRun = executeLoopBlocked.body as { executedWorkflows: Array<{ status: string }> };
  assert.ok(secondRun.executedWorkflows.some((item) => item.status === 'blocked'));

  const history = await request(server)
    .get(
      `/automation/workflows/${workflowId}/executions?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${token}`);
  assert.equal(history.status, 200);
  const items = history.body as Array<{ status: string }>;
  assert.ok(items.some((item) => item.status === 'success'));
  assert.ok(items.some((item) => item.status === 'blocked'));

  const pause = await request(server)
    .patch(`/automation/workflows/${workflowId}/pause`)
    .set('Authorization', `Bearer ${token}`)
    .send({ organizationId: organization.id });
  assert.equal(pause.status, 200);
  assert.equal((pause.body as { status: string }).status, 'paused');

  await prisma.workflowExecutionLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.workflowAction.deleteMany({
    where: { workflow: { organizationId: organization.id } }
  });
  await prisma.workflowConditionGroup.deleteMany({
    where: { workflow: { organizationId: organization.id } }
  });
  await prisma.workflowTrigger.deleteMany({
    where: { workflow: { organizationId: organization.id } }
  });
  await prisma.workflowVersion.deleteMany({
    where: { workflow: { organizationId: organization.id } }
  });
  await prisma.workflow.deleteMany({ where: { organizationId: organization.id } });
  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
