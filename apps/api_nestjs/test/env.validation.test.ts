import assert from 'node:assert/strict';
import test from 'node:test';

import { loadEnv } from '../src/config/env.schema.js';

void test('loadEnv throws when required env vars are missing', () => {
  assert.throws(() => loadEnv({}), /DATABASE_URL/);
});

void test('loadEnv returns typed env when required vars are provided', () => {
  const env = loadEnv({
    DATABASE_URL: 'postgresql://localhost:5432/studioos',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'access-secret-placeholder',
    JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-placeholder'
  });

  assert.equal(env.PORT, 3000);
  assert.equal(env.NODE_ENV, 'development');
});
