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
  PAYMENT_WEBHOOK_DEMO_SECRET: 'webhook-secret-for-tests'
};

async function bootApp(
  featureEnabled: boolean,
  options?: { publicLaunchEnabled?: boolean; rolloutPercentage?: number; killSwitch?: boolean }
): Promise<INestApplication> {
  Object.assign(process.env, {
    ...baseEnv,
    FEATURE_MARKETPLACE_ENABLED: String(featureEnabled),
    FEATURE_PUBLIC_LAUNCH_ENABLED: String(options?.publicLaunchEnabled ?? true),
    PUBLIC_ROLLOUT_PERCENTAGE: String(options?.rolloutPercentage ?? 100),
    PUBLIC_MODULES_GLOBAL_KILL_SWITCH: String(options?.killSwitch ?? false)
  });

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

void test('marketplace feature flag controls access and writes audit logs', async () => {
  const previousEnv = { ...process.env };

  const appDisabled = await bootApp(false);
  const prismaDisabled = appDisabled.get(PrismaService);
  const suffix = Date.now().toString();

  const organization = await prismaDisabled.organization.create({
    data: { name: `Market Org ${suffix}` }
  });
  const user = await prismaDisabled.user.create({
    data: {
      email: `market-${suffix}@studioos.dev`,
      firstName: 'Market',
      lastName: 'Owner',
      passwordHash: await bcrypt.hash('Password123!', 10)
    }
  });
  await prismaDisabled.membership.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: 'owner'
    }
  });

  const disabledServer = appDisabled.getHttpServer() as Parameters<typeof request>[0];
  const loginDisabled = await request(disabledServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  const token = (loginDisabled.body as { accessToken: string }).accessToken;

  const disabledSearch = await request(disabledServer)
    .get(
      `/marketplace/search?organizationId=${encodeURIComponent(organization.id)}&category=camera`
    )
    .set('Authorization', `Bearer ${token}`);
  assert.equal(disabledSearch.status, 404);

  await appDisabled.close();

  const appEnabled = await bootApp(true);
  const prismaEnabled = appEnabled.get(PrismaService);
  await prismaEnabled.asset.create({
    data: {
      organizationId: organization.id,
      name: 'Market Cam',
      category: 'camera'
    }
  });

  const enabledServer = appEnabled.getHttpServer() as Parameters<typeof request>[0];
  const loginEnabled = await request(enabledServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  const enabledToken = (loginEnabled.body as { accessToken: string }).accessToken;

  const enabledSearch = await request(enabledServer)
    .get(
      `/marketplace/search?organizationId=${encodeURIComponent(organization.id)}&category=camera`
    )
    .set('Authorization', `Bearer ${enabledToken}`);
  assert.equal(enabledSearch.status, 200);

  const audit = await prismaEnabled.auditLog.findFirst({
    where: {
      organizationId: organization.id,
      action: 'marketplace.search.executed'
    }
  });
  assert.ok(audit);

  const appKillSwitch = await bootApp(true, { killSwitch: true, rolloutPercentage: 100 });
  const killSwitchServer = appKillSwitch.getHttpServer() as Parameters<typeof request>[0];
  const loginKillSwitch = await request(killSwitchServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  const killSwitchToken = (loginKillSwitch.body as { accessToken: string }).accessToken;

  const killSwitchSearch = await request(killSwitchServer)
    .get(
      `/marketplace/search?organizationId=${encodeURIComponent(organization.id)}&category=camera`
    )
    .set('Authorization', `Bearer ${killSwitchToken}`);
  assert.equal(killSwitchSearch.status, 404);

  const appRolloutDisabled = await bootApp(true, {
    publicLaunchEnabled: true,
    rolloutPercentage: 0,
    killSwitch: false
  });
  const rolloutDisabledServer = appRolloutDisabled.getHttpServer() as Parameters<typeof request>[0];
  const loginRolloutDisabled = await request(rolloutDisabledServer).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  const rolloutDisabledToken = (loginRolloutDisabled.body as { accessToken: string }).accessToken;

  const rolloutDisabledSearch = await request(rolloutDisabledServer)
    .get(
      `/marketplace/search?organizationId=${encodeURIComponent(organization.id)}&category=camera`
    )
    .set('Authorization', `Bearer ${rolloutDisabledToken}`);
  assert.equal(rolloutDisabledSearch.status, 404);

  await prismaEnabled.auditLog.deleteMany({ where: { organizationId: organization.id } });
  await prismaEnabled.asset.deleteMany({ where: { organizationId: organization.id } });
  await prismaEnabled.membership.deleteMany({ where: { organizationId: organization.id } });
  await prismaEnabled.refreshToken.deleteMany({ where: { userId: user.id } });
  await prismaEnabled.user.delete({ where: { id: user.id } });
  await prismaEnabled.organization.delete({ where: { id: organization.id } });

  await appEnabled.close();
  await appKillSwitch.close();
  await appRolloutDisabled.close();
  process.env = previousEnv;
});
