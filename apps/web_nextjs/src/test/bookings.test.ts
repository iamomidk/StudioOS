import assert from 'node:assert/strict';
import test from 'node:test';

import { filterBookingsByStatus } from '../lib/bookings';

void test('filterBookingsByStatus returns matching bookings for specific status', () => {
  const bookings = [
    { status: 'draft', id: '1' },
    { status: 'confirmed', id: '2' },
    { status: 'draft', id: '3' }
  ];

  const draft = filterBookingsByStatus(bookings, 'draft');
  assert.equal(draft.length, 2);
});

void test('filterBookingsByStatus returns all bookings when status is all', () => {
  const bookings = [{ status: 'draft', id: '1' }];
  const all = filterBookingsByStatus(bookings, 'all');
  assert.equal(all.length, 1);
});
