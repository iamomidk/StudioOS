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

void test('enterprise controls enforce SSO policy, deprovisioning, and compliance exports', async () => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
    JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
    ENTERPRISE_DEPROVISION_GRACE_SECONDS: '0'
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
    data: {
      name: `Enterprise Org ${suffix}`
    }
  });

  const owner = await prisma.user.create({
    data: {
      email: `enterprise-owner-${suffix}@studioos.dev`,
      firstName: 'Enterprise',
      lastName: 'Owner',
      passwordHash: await bcrypt.hash(password, 10),
      mfaEnabled: true
    }
  });

  const shooter = await prisma.user.create({
    data: {
      email: `enterprise-shooter-${suffix}@studioos.dev`,
      firstName: 'Enterprise',
      lastName: 'Shooter',
      passwordHash: await bcrypt.hash(password, 10),
      mfaEnabled: true
    }
  });

  const member = await prisma.user.create({
    data: {
      email: `enterprise-member-${suffix}@studioos.dev`,
      firstName: 'Enterprise',
      lastName: 'Member',
      passwordHash: await bcrypt.hash(password, 10)
    }
  });

  await prisma.membership.createMany({
    data: [
      { organizationId: organization.id, userId: owner.id, role: 'owner' },
      { organizationId: organization.id, userId: shooter.id, role: 'shooter' },
      { organizationId: organization.id, userId: member.id, role: 'editor' }
    ]
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];

  const ownerLogin = await request(server).post('/auth/login').send({
    email: owner.email,
    password,
    mfaCode: '000000'
  });
  assert.equal(ownerLogin.status, 200);
  const ownerToken = (ownerLogin.body as { accessToken: string }).accessToken;

  const memberLogin = await request(server).post('/auth/login').send({
    email: member.email,
    password
  });
  assert.equal(memberLogin.status, 200);
  const memberAccessToken = (memberLogin.body as { accessToken: string }).accessToken;

  const settings = await request(server)
    .patch('/enterprise/settings')
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-forwarded-for', '127.0.0.1')
    .send({
      organizationId: organization.id,
      ssoEnforced: true,
      ssoProvider: 'oidc',
      ssoDomains: ['studioos.dev'],
      enterpriseScimEnabled: true,
      sessionDurationMinutes: 60,
      mfaEnforced: false,
      ipAllowlist: ['127.0.0.1'],
      retentionDays: 90,
      reason: 'Enable enterprise baseline'
    });
  assert.equal(settings.status, 200);
  assert.equal((settings.body as { ssoEnforced: boolean }).ssoEnforced, true);

  const ssoBlockedLogin = await request(server).post('/auth/login').send({
    email: member.email,
    password
  });
  assert.equal(ssoBlockedLogin.status, 401);

  const mfaSettings = await request(server)
    .patch('/enterprise/settings')
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-forwarded-for', '127.0.0.1')
    .send({
      organizationId: organization.id,
      ssoEnforced: false,
      mfaEnforced: true,
      reason: 'Require MFA for enterprise org'
    });
  assert.equal(mfaSettings.status, 200);

  const mfaBlocked = await request(server).post('/auth/login').send({
    email: member.email,
    password,
    mfaCode: '000000'
  });
  assert.equal(mfaBlocked.status, 401);

  const provisioned = await request(server)
    .post('/enterprise/provisioning/users')
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-forwarded-for', '127.0.0.1')
    .send({
      organizationId: organization.id,
      email: `provisioned-${suffix}@studioos.dev`,
      firstName: 'Provisioned',
      lastName: 'User',
      role: 'manager',
      mfaEnabled: true
    });
  assert.equal(provisioned.status, 201);
  const provisionedUserId = (provisioned.body as { id: string }).id;

  const shooterLogin = await request(server).post('/auth/login').send({
    email: shooter.email,
    password,
    mfaCode: '000000'
  });
  assert.equal(shooterLogin.status, 200);
  const shooterToken = (shooterLogin.body as { accessToken: string }).accessToken;

  const shooterExportAttempt = await request(server)
    .get(`/enterprise/exports/audit?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${shooterToken}`)
    .set('x-forwarded-for', '127.0.0.1');
  assert.equal(shooterExportAttempt.status, 403);

  const deactivated = await request(server)
    .patch(`/enterprise/provisioning/users/${encodeURIComponent(member.id)}/deactivate`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-forwarded-for', '127.0.0.1')
    .send({
      organizationId: organization.id,
      reason: 'User departed company'
    });
  assert.equal(deactivated.status, 200);

  const blockedProfile = await request(server)
    .get('/auth/profile')
    .set('Authorization', `Bearer ${memberAccessToken}`)
    .set('x-forwarded-for', '127.0.0.1');
  assert.equal(blockedProfile.status, 401);

  const exportAudit = await request(server)
    .get(`/enterprise/exports/audit?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-forwarded-for', '127.0.0.1');
  assert.equal(exportAudit.status, 200);
  assert.equal((exportAudit.body as { export: { rowCount: number } }).export.rowCount > 0, true);

  const exportAccess = await request(server)
    .get(`/enterprise/exports/access?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-forwarded-for', '127.0.0.1');
  assert.equal(exportAccess.status, 200);

  const purgeRequested = await request(server)
    .post(`/enterprise/users/${encodeURIComponent(provisionedUserId)}/purge-requests`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-forwarded-for', '127.0.0.1')
    .send({
      organizationId: organization.id,
      reason: 'Retention policy cleanup'
    });
  assert.equal(purgeRequested.status, 201);
  const purgeRequestId = (purgeRequested.body as { id: string }).id;

  const purgeApproved = await request(server)
    .patch(`/enterprise/purge-requests/${encodeURIComponent(purgeRequestId)}/approve`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .set('x-forwarded-for', '127.0.0.1')
    .send({
      organizationId: organization.id,
      reason: 'Approved by security admin',
      executeNow: true
    });
  assert.equal(purgeApproved.status, 200);

  await prisma.enterprisePurgeRequest.deleteMany({ where: { organizationId: organization.id } });
  await prisma.complianceExportRecord.deleteMany({ where: { organizationId: organization.id } });
  await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prisma.refreshToken.deleteMany({
    where: { userId: { in: [owner.id, shooter.id, member.id] } }
  });
  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [owner.id, shooter.id, member.id, provisionedUserId]
      }
    }
  });
  await prisma.organization.deleteMany({ where: { id: organization.id } });

  await app.close();
  process.env = previousEnv;
});
