import assert from 'node:assert/strict';
import test from 'node:test';

import { AppConfigService } from '../src/config/app-config.service.js';
import { loadEnv } from '../src/config/env.schema.js';

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://omid@localhost:5432/studioos',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'test-access-secret',
  JWT_REFRESH_TOKEN_SECRET: 'test-refresh-secret'
};

void test('public rollout helper enforces default-deny and deterministic bucketing', () => {
  const disabledConfig = new AppConfigService(
    loadEnv({
      ...baseEnv,
      FEATURE_PUBLIC_LAUNCH_ENABLED: 'false',
      PUBLIC_ROLLOUT_PERCENTAGE: '100'
    })
  );
  assert.equal(disabledConfig.isPublicRolloutEnabledFor('org-a', null), false);

  const enabledConfig = new AppConfigService(
    loadEnv({
      ...baseEnv,
      FEATURE_PUBLIC_LAUNCH_ENABLED: 'true',
      PUBLIC_ROLLOUT_PERCENTAGE: '25',
      PUBLIC_ROLLOUT_HASH_SALT: 'test-salt'
    })
  );

  const first = enabledConfig.isPublicRolloutEnabledFor('org-stable', null);
  const second = enabledConfig.isPublicRolloutEnabledFor('org-stable', null);
  assert.equal(first, second);

  const allowlistedConfig = new AppConfigService(
    loadEnv({
      ...baseEnv,
      FEATURE_PUBLIC_LAUNCH_ENABLED: 'true',
      PUBLIC_ROLLOUT_PERCENTAGE: '0',
      PUBLIC_ROLLOUT_ALLOWLIST_ORG_IDS: 'org-allowlisted'
    })
  );
  assert.equal(allowlistedConfig.isPublicRolloutEnabledFor('org-allowlisted', null), true);
});
