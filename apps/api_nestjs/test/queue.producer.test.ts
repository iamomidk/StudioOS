import assert from 'node:assert/strict';
import test from 'node:test';

import { MetricsService } from '../src/common/modules/metrics/metrics.service.js';
import type { AppConfigService } from '../src/config/app-config.service.js';
import { DEFAULT_JOB_OPTIONS } from '../src/modules/queues/queue.constants.js';
import type { QueuePort } from '../src/modules/queues/queue.port.js';
import { QueueProducerService } from '../src/modules/queues/queue.producer.service.js';

interface AddedJob {
  name: string;
  payload: unknown;
  options: unknown;
}

class FakeQueue implements QueuePort {
  public readonly added: AddedJob[] = [];

  add<TPayload>(name: string, payload: TPayload, options?: unknown): Promise<void> {
    this.added.push({ name, payload, options });
    return Promise.resolve();
  }
}

void test('QueueProducerService enqueues notification job with retry/backoff defaults', async () => {
  const notificationsQueue = new FakeQueue();
  const remindersQueue = new FakeQueue();
  const mediaQueue = new FakeQueue();

  const producer = new QueueProducerService(
    notificationsQueue,
    remindersQueue,
    mediaQueue,
    new MetricsService(),
    {
      regionId: 'us-east-1',
      failoverMode: 'off'
    } as AppConfigService
  );

  await producer.enqueueNotification({
    recipientUserId: 'user-1',
    channel: 'email',
    template: 'booking-confirmed'
  });

  assert.equal(notificationsQueue.added.length, 1);
  assert.deepEqual(notificationsQueue.added[0], {
    name: 'notify-user',
    payload: {
      recipientUserId: 'user-1',
      channel: 'email',
      template: 'booking-confirmed',
      meta: {
        regionOrigin: 'us-east-1',
        failoverMode: 'off'
      }
    },
    options: DEFAULT_JOB_OPTIONS
  });
});

void test('QueueProducerService assigns deterministic job IDs for regional failover dedupe', async () => {
  const notificationsQueue = new FakeQueue();
  const remindersQueue = new FakeQueue();
  const mediaQueue = new FakeQueue();

  const producer = new QueueProducerService(
    notificationsQueue,
    remindersQueue,
    mediaQueue,
    new MetricsService(),
    {
      regionId: 'eu-west-1',
      failoverMode: 'passive'
    } as AppConfigService
  );

  await producer.enqueueInvoiceReminder({
    invoiceId: 'inv-1',
    organizationId: 'org-1',
    reminderType: 'overdue'
  });
  await producer.enqueueMediaJob({
    assetId: 'asset-1',
    sourceUrl: 'https://cdn.example.com/a.mp4',
    operation: 'thumbnail'
  });

  assert.equal(remindersQueue.added.length, 1);
  assert.equal(mediaQueue.added.length, 1);
  assert.equal(
    (remindersQueue.added[0]?.options as { jobId?: string }).jobId,
    'invoice-reminder:inv-1:overdue'
  );
  assert.equal(
    (mediaQueue.added[0]?.options as { jobId?: string }).jobId,
    'media:asset-1:thumbnail:https://cdn.example.com/a.mp4'
  );
});
