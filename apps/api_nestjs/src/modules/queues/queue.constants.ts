import type { JobsOptions } from 'bullmq';

export const QUEUE_NAMES = {
  notifications: 'notifications',
  notificationsDeadLetter: 'notifications-dead-letter',
  invoiceReminders: 'invoice-reminders',
  mediaJobs: 'media-jobs'
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 3000
  },
  removeOnComplete: true,
  removeOnFail: 50
};
