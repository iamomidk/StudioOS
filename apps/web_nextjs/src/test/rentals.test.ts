import assert from 'node:assert/strict';
import test from 'node:test';

import { formatRentalStatus, getNextRentalStatuses } from '../lib/rentals';

void test('getNextRentalStatuses follows lifecycle rules', () => {
  assert.deepEqual(getNextRentalStatuses('reserved'), ['picked_up', 'cancelled']);
  assert.deepEqual(getNextRentalStatuses('picked_up'), ['returned', 'incident']);
  assert.deepEqual(getNextRentalStatuses('returned'), []);
});

void test('formatRentalStatus formats snake case status', () => {
  assert.equal(formatRentalStatus('picked_up'), 'picked up');
});
