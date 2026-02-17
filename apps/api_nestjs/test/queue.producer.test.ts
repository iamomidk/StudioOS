import assert from 'node:assert/strict';
import test from 'node:test';

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

  const producer = new QueueProducerService(notificationsQueue, remindersQueue, mediaQueue);

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
      template: 'booking-confirmed'
    },
    options: DEFAULT_JOB_OPTIONS
  });
});
