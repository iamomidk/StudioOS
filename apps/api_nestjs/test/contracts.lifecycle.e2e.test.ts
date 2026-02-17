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

void test('contract lifecycle supports approvals, signature updates, amendment lineage, renewal schedule and search', async () => {
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
    data: { name: `Contract Org ${suffix}` }
  });

  const user = await prisma.user.create({
    data: {
      email: `contracts-${suffix}@studioos.dev`,
      firstName: 'Contract',
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
      name: 'Contract Client',
      email: `contract-client-${suffix}@example.com`
    }
  });

  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const login = await request(server).post('/auth/login').send({
    email: user.email,
    password: 'Password123!'
  });
  assert.equal(login.status, 200);
  const accessToken = (login.body as { accessToken: string }).accessToken;

  const clauseSetResponse = await request(server)
    .post('/contracts/clause-sets')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      name: `MSA-${suffix}`,
      clauses: [{ key: 'payment_terms', text: 'Net 30' }],
      requiredClauseKeys: ['payment_terms']
    });
  assert.equal(clauseSetResponse.status, 201);
  const clauseSetId = (clauseSetResponse.body as { id: string }).id;

  const missingClauseContract = await request(server)
    .post('/contracts')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId: client.id,
      contractType: 'msa',
      contractValueCents: 350000,
      riskTier: 'high',
      clauseSetId,
      clauseKeys: []
    });
  assert.equal(missingClauseContract.status, 201);
  const missingContractId = (missingClauseContract.body as { id: string }).id;

  const blockedSend = await request(server)
    .post(`/contracts/${missingContractId}/advance`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      action: 'send_for_signature'
    });
  assert.equal(blockedSend.status, 422);

  const contractResponse = await request(server)
    .post('/contracts')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      clientId: client.id,
      contractType: 'msa',
      contractValueCents: 350000,
      riskTier: 'high',
      clauseSetId,
      clauseKeys: ['payment_terms']
    });
  assert.equal(contractResponse.status, 201);
  const contractId = (contractResponse.body as { id: string }).id;

  const contractRecord = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: { approvalFlow: { include: { steps: true } } }
  });
  assert.equal(contractRecord.approvalFlow?.steps.length, 2);

  for (const step of contractRecord.approvalFlow?.steps ?? []) {
    const approveStep = await request(server)
      .post(`/contracts/${contractId}/approve-step`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        organizationId: organization.id,
        approvalStepId: step.id,
        approved: true,
        note: 'Approved in test'
      });
    assert.equal(approveStep.status, 201);
  }

  const sendForSignature = await request(server)
    .post(`/contracts/${contractId}/advance`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      action: 'send_for_signature'
    });
  assert.equal(sendForSignature.status, 201);

  const signatureWebhook = await request(server)
    .post(`/contracts/${contractId}/signature-webhook`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      providerEventId: `evt-${suffix}`,
      status: 'signed',
      providerRef: `sig-${suffix}`
    });
  assert.equal(signatureWebhook.status, 201);

  const amendment = await request(server)
    .post(`/contracts/${contractId}/amendments`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      reason: 'Expand service scope',
      clauseKeys: ['payment_terms', 'sla_terms']
    });
  assert.equal(amendment.status, 201, JSON.stringify(amendment.body));
  const amendmentBody = amendment.body as {
    amendment: { id: string };
    version: { versionNumber: number };
  };
  assert.equal(typeof amendmentBody.amendment.id, 'string');
  assert.equal(amendmentBody.version.versionNumber, 2);

  const renewal = await request(server)
    .post(`/contracts/${contractId}/renewal-schedule`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      organizationId: organization.id,
      renewAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      reminderDaysBefore: 45,
      autoDraftAmendment: true
    });
  assert.equal(renewal.status, 201);

  const search = await request(server)
    .get('/contracts')
    .query({ organizationId: organization.id, contractType: 'msa', minValueCents: 100000 })
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(search.status, 200);
  const searchResults = search.body as Array<{ id: string }>;
  assert.equal(
    searchResults.some((contract) => contract.id === contractId),
    true
  );

  await app.close();
  process.env = previousEnv;
});
