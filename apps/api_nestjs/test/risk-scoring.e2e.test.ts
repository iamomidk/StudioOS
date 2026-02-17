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

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
  FEATURE_PUBLIC_LAUNCH_ENABLED: 'true',
  PUBLIC_ROLLOUT_PERCENTAGE: '100'
};

async function bootApp(overrides: Record<string, string>): Promise<INestApplication> {
  Object.assign(process.env, baseEnv, overrides);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  await app.init();
  return app;
}

void test('risk scoring supports advisory and hard-enforce modes with kill switch override', async () => {
  const previousEnv = { ...process.env };
  const suffix = Date.now().toString();

  const advisoryApp = await bootApp({
    RISK_SCORING_MODE: 'ADVISORY',
    RISK_SCORING_GLOBAL_KILL_SWITCH: 'false',
    RISK_SCORING_ENFORCE_COHORT_IDS: 'pilot-risk',
    FEATURE_DISPUTES_ENABLED: 'true'
  });

  const prisma = advisoryApp.get(PrismaService);

  const organization = await prisma.organization.create({
    data: {
      name: `Risk Org ${suffix}`,
      pilotOrg: true,
      pilotCohortId: 'pilot-risk'
    }
  });

  const user = await prisma.user.create({
    data: {
      email: `risk-${suffix}@studioos.dev`,
      firstName: 'Risk',
      lastName: 'Owner',
      passwordHash: await bcrypt.hash('Password123!', 10)
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
      name: 'Risk Client'
    }
  });

  const asset = await prisma.asset.create({
    data: {
      organizationId: organization.id,
      name: 'Risk Camera',
      category: 'camera'
    }
  });

  const inventoryItems = [] as string[];
  for (let index = 0; index < 6; index += 1) {
    const item = await prisma.inventoryItem.create({
      data: {
        organizationId: organization.id,
        assetId: asset.id,
        serialNumber: `risk-serial-${suffix}-${index}`,
        condition: 'good'
      }
    });
    inventoryItems.push(item.id);
  }

  for (let index = 0; index < 5; index += 1) {
    await prisma.rentalOrder.create({
      data: {
        organizationId: organization.id,
        inventoryItemId: inventoryItems[index]!,
        clientId: client.id,
        startsAt: new Date(Date.now() + (index + 1) * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + (index + 2) * 60 * 60 * 1000),
        status: 'reserved'
      }
    });
  }

  for (let index = 0; index < 10; index += 1) {
    await prisma.booking.create({
      data: {
        organizationId: organization.id,
        clientId: client.id,
        title: `Risk Booking ${index}`,
        startsAt: new Date(Date.now() + (index + 10) * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + (index + 11) * 60 * 60 * 1000),
        status: 'draft'
      }
    });
  }

  for (let index = 0; index < 3; index += 1) {
    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        entityType: 'Dispute',
        entityId: `risk-dispute-${index}`,
        action: 'dispute.created'
      }
    });
  }

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      invoiceNumber: `RISK-INV-${suffix}`,
      subtotalCents: 100000,
      taxCents: 0,
      totalCents: 100000,
      status: 'issued'
    }
  });

  await prisma.payment.createMany({
    data: [
      {
        organizationId: organization.id,
        invoiceId: invoice.id,
        provider: 'demo',
        providerRef: `risk-pay-a-${suffix}`,
        amountCents: 1000,
        currency: 'USD',
        status: 'failed'
      },
      {
        organizationId: organization.id,
        invoiceId: invoice.id,
        provider: 'demo',
        providerRef: `risk-pay-b-${suffix}`,
        amountCents: 1000,
        currency: 'USD',
        status: 'refunded'
      }
    ]
  });

  const server = advisoryApp.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  assert.equal(login.status, 200);
  const token = (login.body as { accessToken: string }).accessToken;

  const advisoryCreate = await request(server)
    .post('/rentals')
    .set('Authorization', `Bearer ${token}`)
    .send({
      organizationId: organization.id,
      inventoryItemId: inventoryItems[5],
      clientId: client.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()
    });
  assert.equal(advisoryCreate.status, 201);

  const explain = await request(server)
    .get(`/risk/explain?organizationId=${encodeURIComponent(organization.id)}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(explain.status, 200);
  assert.equal(Array.isArray(explain.body), true);
  const explainItems = explain.body as Array<{ reasonCodes: string[] }>;
  assert.ok((explainItems[0]?.reasonCodes.length ?? 0) > 0);

  await advisoryApp.close();

  const hardApp = await bootApp({
    RISK_SCORING_MODE: 'HARD_ENFORCE',
    RISK_SCORING_GLOBAL_KILL_SWITCH: 'false',
    RISK_SCORING_ENFORCE_COHORT_IDS: 'pilot-risk',
    FEATURE_DISPUTES_ENABLED: 'true'
  });

  const hardServer = hardApp.getHttpServer() as Parameters<typeof request>[0];
  const hardLogin = await request(hardServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  const hardToken = (hardLogin.body as { accessToken: string }).accessToken;

  const blockedCreate = await request(hardServer)
    .post('/rentals')
    .set('Authorization', `Bearer ${hardToken}`)
    .send({
      organizationId: organization.id,
      inventoryItemId: inventoryItems[5],
      clientId: client.id,
      startsAt: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString()
    });
  assert.equal(blockedCreate.status, 409);

  await hardApp.close();

  const killSwitchApp = await bootApp({
    RISK_SCORING_MODE: 'HARD_ENFORCE',
    RISK_SCORING_GLOBAL_KILL_SWITCH: 'true',
    RISK_SCORING_ENFORCE_COHORT_IDS: 'pilot-risk',
    FEATURE_DISPUTES_ENABLED: 'true'
  });

  const killSwitchServer = killSwitchApp.getHttpServer() as Parameters<typeof request>[0];
  const killSwitchLogin = await request(killSwitchServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  const killSwitchToken = (killSwitchLogin.body as { accessToken: string }).accessToken;

  const allowedWithKillSwitch = await request(killSwitchServer)
    .post('/rentals')
    .set('Authorization', `Bearer ${killSwitchToken}`)
    .send({
      organizationId: organization.id,
      inventoryItemId: inventoryItems[5],
      clientId: client.id,
      startsAt: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 29 * 60 * 60 * 1000).toISOString()
    });
  assert.equal(allowedWithKillSwitch.status, 201);

  const prismaCleanup = killSwitchApp.get(PrismaService);
  await prismaCleanup.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prismaCleanup.riskEvaluation.deleteMany({ where: { organizationId: organization.id } });
  await prismaCleanup.paymentWebhookEvent.deleteMany({
    where: { organizationId: organization.id }
  });
  await prismaCleanup.payment.deleteMany({ where: { organizationId: organization.id } });
  await prismaCleanup.invoice.deleteMany({ where: { organizationId: organization.id } });
  await prismaCleanup.booking.deleteMany({ where: { organizationId: organization.id } });
  await prismaCleanup.rentalOrder.deleteMany({ where: { organizationId: organization.id } });
  await prismaCleanup.inventoryItem.deleteMany({ where: { organizationId: organization.id } });
  await prismaCleanup.asset.deleteMany({ where: { organizationId: organization.id } });
  await prismaCleanup.client.deleteMany({ where: { organizationId: organization.id } });
  await prismaCleanup.membership.deleteMany({ where: { organizationId: organization.id } });
  await prismaCleanup.refreshToken.deleteMany({ where: { userId: user.id } });
  await prismaCleanup.user.delete({ where: { id: user.id } });
  await prismaCleanup.organization.delete({ where: { id: organization.id } });

  await killSwitchApp.close();
  process.env = previousEnv;
});
