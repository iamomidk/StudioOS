import type { JobsOptions } from 'bullmq';

import type { QueuePort } from './queue.port.js';

export class InMemoryQueueAdapter implements QueuePort {
  async add<TPayload>(name: string, payload: TPayload, options?: JobsOptions): Promise<void> {
    void name;
    void payload;
    void options;
    return Promise.resolve();
  }
}
