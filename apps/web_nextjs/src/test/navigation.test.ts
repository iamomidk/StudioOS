import assert from 'node:assert/strict';
import test from 'node:test';

import { DASHBOARD_NAV_ITEMS } from '../lib/navigation';

void test('dashboard navigation exposes required left-nav sections', () => {
  const labels = DASHBOARD_NAV_ITEMS.map((item) => item.label);

  assert.deepEqual(labels, [
    'CRM',
    'Bookings',
    'Projects',
    'Inventory',
    'Rentals',
    'Billing',
    'Support'
  ]);
});
