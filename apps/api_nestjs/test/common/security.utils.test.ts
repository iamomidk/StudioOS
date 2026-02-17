import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isOriginAllowed,
  MemoryRateLimiter,
  parseCsvAllowlist
} from '../../src/common/security/security.utils.js';

void test('parseCsvAllowlist trims values and skips blanks', () => {
  assert.deepEqual(parseCsvAllowlist(' https://a.dev, ,https://b.dev '), [
    'https://a.dev',
    'https://b.dev'
  ]);
});

void test('isOriginAllowed enforces explicit allowlist', () => {
  const allowlist = ['https://app.studioos.dev'];
  assert.equal(isOriginAllowed('https://app.studioos.dev', allowlist), true);
  assert.equal(isOriginAllowed('https://evil.dev', allowlist), false);
});

void test('MemoryRateLimiter blocks after max requests in same window', () => {
  let now = 1_000;
  const limiter = new MemoryRateLimiter(2, 10, () => now);

  assert.deepEqual(limiter.check('127.0.0.1'), { allowed: true, retryAfterSeconds: 10 });
  assert.equal(limiter.check('127.0.0.1').allowed, true);
  assert.equal(limiter.check('127.0.0.1').allowed, false);

  now = 12_000;
  assert.equal(limiter.check('127.0.0.1').allowed, true);
});
