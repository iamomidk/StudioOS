import { Worker, type ConnectionOptions, type Job } from 'bullmq';

import { QUEUE_NAMES, type QueueName } from './queue.constants.js';

export interface QueueJobProcessor {
  process(queueName: QueueName, job: Job): Promise<void>;
}

export function createQueueWorkers(
  connection: ConnectionOptions,
  processor: QueueJobProcessor
): Worker[] {
  return (Object.values(QUEUE_NAMES) as QueueName[]).map(
    (queueName) =>
      new Worker(
        queueName,
        async (job) => {
          await processor.process(queueName, job);
        },
        {
          connection,
          concurrency: 5
        }
      )
  );
}
