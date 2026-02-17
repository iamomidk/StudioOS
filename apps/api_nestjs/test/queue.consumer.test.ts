import assert from 'node:assert/strict';
import test from 'node:test';

import { QUEUE_NAMES } from '../src/modules/queues/queue.constants.js';
import { NotificationDispatchError } from '../src/modules/queues/notification-dispatch.service.js';
import { QueueConsumerService } from '../src/modules/queues/queue.consumer.service.js';
import type { NotificationJobPayload } from '../src/modules/queues/queue.payloads.js';
import type { QueuePort } from '../src/modules/queues/queue.port.js';

class FakeDeadLetterQueue implements QueuePort {
  public readonly added: Array<{ name: string; payload: unknown }> = [];

  add<TPayload>(name: string, payload: TPayload): Promise<void> {
    this.added.push({ name, payload });
    return Promise.resolve();
  }
}

class FakeNotificationDispatchService {
  constructor(private readonly behavior: 'ok' | 'transient' | 'permanent') {}

  dispatch(payload: NotificationJobPayload): Promise<void> {
    void payload;
    if (this.behavior === 'ok') {
      return Promise.resolve();
    }
    if (this.behavior === 'transient') {
      return Promise.reject(new NotificationDispatchError('transient', 'temporary outage'));
    }
    return Promise.reject(new NotificationDispatchError('permanent', 'template missing'));
  }
}

function buildConsumer(behavior: 'ok' | 'transient' | 'permanent') {
  const deadLetterQueue = new FakeDeadLetterQueue();
  const consumer = new QueueConsumerService(
    new FakeNotificationDispatchService(behavior) as never,
    deadLetterQueue
  );

  return { consumer, deadLetterQueue };
}

void test('QueueConsumerService routes media jobs to media processor', async () => {
  const { consumer } = buildConsumer('ok');

  await assert.doesNotReject(async () => {
    await consumer.process(QUEUE_NAMES.mediaJobs, {
      id: 'job-1',
      data: {
        assetId: 'asset-1',
        sourceUrl: 'https://example.com/file.mov',
        operation: 'metadata'
      }
    } as never);
  });
});

void test('notification transient failure throws before max attempts and does not dead-letter', async () => {
  const { consumer, deadLetterQueue } = buildConsumer('transient');

  await assert.rejects(async () => {
    await consumer.process(QUEUE_NAMES.notifications, {
      id: 'job-2',
      data: {
        recipientUserId: 'user-1',
        channel: 'email',
        template: 'invoice-issued'
      },
      attemptsMade: 0,
      opts: { attempts: 3 }
    } as never);
  });

  assert.equal(deadLetterQueue.added.length, 0);
});

void test('notification permanent failure moves job to dead-letter queue', async () => {
  const { consumer, deadLetterQueue } = buildConsumer('permanent');

  await assert.doesNotReject(async () => {
    await consumer.process(QUEUE_NAMES.notifications, {
      id: 'job-3',
      data: {
        recipientUserId: 'user-1',
        channel: 'email',
        template: 'invoice-issued'
      },
      attemptsMade: 0,
      opts: { attempts: 3 }
    } as never);
  });

  assert.equal(deadLetterQueue.added.length, 1);
  assert.equal(deadLetterQueue.added[0]?.name, 'dead-letter-notification');
});

void test('notification transient failure on last attempt moves job to dead-letter queue', async () => {
  const { consumer, deadLetterQueue } = buildConsumer('transient');

  await assert.doesNotReject(async () => {
    await consumer.process(QUEUE_NAMES.notifications, {
      id: 'job-4',
      data: {
        recipientUserId: 'user-1',
        channel: 'email',
        template: 'invoice-issued'
      },
      attemptsMade: 2,
      opts: { attempts: 3 }
    } as never);
  });

  assert.equal(deadLetterQueue.added.length, 1);
});
