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

interface AuthTokensResponse {
  accessToken: string;
}

void test('support tickets can be submitted, triaged, and admin actions are audited', async () => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
    JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
    FEATURE_SUPPORT_ADMIN_ACTIONS_ENABLED: 'true',
    SUPPORT_MAX_SUBMISSIONS_PER_MINUTE: '1',
    SUPPORT_ALLOWED_ATTACHMENT_TYPES: 'image/png,application/pdf',
    SUPPORT_MAX_ATTACHMENT_BYTES: '1024'
  });

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
  const password = 'Password123!';

  const organization = await prisma.organization.create({
    data: { name: `Support Org ${suffix}`, pilotOrg: true }
  });

  const owner = await prisma.user.create({
    data: {
      email: `support-owner-${suffix}@studioos.dev`,
      firstName: 'Support',
      lastName: 'Owner',
      passwordHash: await bcrypt.hash(password, 10)
    }
  });

  const shooter = await prisma.user.create({
    data: {
      email: `support-shooter-${suffix}@studioos.dev`,
      firstName: 'Support',
      lastName: 'Shooter',
      passwordHash: await bcrypt.hash(password, 10)
    }
  });

  await prisma.membership.createMany({
    data: [
      { organizationId: organization.id, userId: owner.id, role: 'owner' },
      { organizationId: organization.id, userId: shooter.id, role: 'shooter' }
    ]
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];

  const ownerLogin = await request(server)
    .post('/auth/login')
    .send({ email: owner.email, password });
  assert.equal(ownerLogin.status, 200);
  const ownerToken = (ownerLogin.body as AuthTokensResponse).accessToken;

  const shooterLogin = await request(server)
    .post('/auth/login')
    .send({ email: shooter.email, password });
  assert.equal(shooterLogin.status, 200);
  const shooterToken = (shooterLogin.body as AuthTokensResponse).accessToken;

  const createTicket = await request(server)
    .post('/support/tickets')
    .set('Authorization', `Bearer ${shooterToken}`)
    .send({
      organizationId: organization.id,
      title: 'Cannot submit booking',
      description: 'Booking submit returns generic error',
      severity: 'p1',
      source: 'web',
      routePath: '/dashboard/bookings',
      appVersion: '1.0.0',
      correlationId: 'corr-1',
      requestId: 'req-1',
      attachments: [
        { url: 'https://example.com/file.png', contentType: 'image/png', sizeBytes: 512 }
      ]
    });

  assert.equal(createTicket.status, 201);
  const ticketId = (createTicket.body as { id: string }).id;

  const rateLimited = await request(server)
    .post('/support/tickets')
    .set('Authorization', `Bearer ${shooterToken}`)
    .send({
      organizationId: organization.id,
      title: 'Second ticket too fast',
      description: 'rate limit test',
      severity: 'p2'
    });
  assert.equal(rateLimited.status, 429);

  const shooterList = await request(server)
    .get(`/support/tickets?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${shooterToken}`);
  assert.equal(shooterList.status, 403);

  const ownerList = await request(server)
    .get(`/support/tickets?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${ownerToken}`);
  assert.equal(ownerList.status, 200);
  assert.equal(((ownerList.body as Array<{ id: string }>)[0] ?? {}).id, ticketId);

  const detail = await request(server)
    .get(
      `/support/tickets/${encodeURIComponent(ticketId)}?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${ownerToken}`);
  assert.equal(detail.status, 200);
  assert.equal((detail.body as { diagnostics: unknown }).diagnostics !== undefined, true);

  const triaged = await request(server)
    .patch(
      `/support/tickets/${encodeURIComponent(ticketId)}/status?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ status: 'triaged' });
  assert.equal(triaged.status, 200);

  const note = await request(server)
    .post(
      `/support/tickets/${encodeURIComponent(ticketId)}/notes?organizationId=${encodeURIComponent(organization.id)}`
    )
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ note: 'Investigating with webhook traces.' });
  assert.equal(note.status, 201);

  const shooterAdminAction = await request(server)
    .post('/support/admin-actions/resend-notification')
    .set('Authorization', `Bearer ${shooterToken}`)
    .send({ organizationId: organization.id, ticketId, referenceId: 'notif-1' });
  assert.equal(shooterAdminAction.status, 403);

  const ownerAdminAction = await request(server)
    .post('/support/admin-actions/resend-notification')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ organizationId: organization.id, ticketId, referenceId: 'notif-1' });
  assert.equal(ownerAdminAction.status, 201);

  const audits = await prisma.auditLog.findMany({
    where: {
      organizationId: organization.id,
      entityType: 'SupportTicket',
      entityId: ticketId
    }
  });

  assert.equal(
    audits.some((row) => row.action === 'support.ticket.created'),
    true
  );
  assert.equal(
    audits.some((row) => row.action === 'support.ticket.status.updated'),
    true
  );
  assert.equal(
    audits.some((row) => row.action === 'support.admin.resend_notification'),
    true
  );

  await prisma.supportTicketNote.deleteMany({ where: { ticketId } });
  await prisma.supportTicket.deleteMany({ where: { organizationId: organization.id } });
  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.pricingConversionEventLink.deleteMany({
    where: { exposureLog: { organizationId: organization.id } }
  });
  await prisma.pricingExposureLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.analyticsEvent.deleteMany({ where: { organizationId: organization.id } });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, shooter.id] } } });
  await prisma.organization.deleteMany({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
