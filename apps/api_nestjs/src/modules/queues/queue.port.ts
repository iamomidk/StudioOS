import type { JobsOptions } from 'bullmq';

export interface QueuePort {
  add<TPayload>(name: string, payload: TPayload, options?: JobsOptions): Promise<void>;
}
