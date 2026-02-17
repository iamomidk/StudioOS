import type { JobsOptions, Queue } from 'bullmq';

import type { QueuePort } from './queue.port.js';

export class BullMqQueueAdapter implements QueuePort {
  constructor(private readonly queue: Queue) {}

  async add<TPayload>(name: string, payload: TPayload, options?: JobsOptions): Promise<void> {
    await this.queue.add(name, payload as object, options);
  }
}
