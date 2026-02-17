import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES, type QueueName } from './queue.constants.js';
import {
  NotificationDispatchError,
  NotificationDispatchService
} from './notification-dispatch.service.js';
import type {
  DeadLetterNotificationJobPayload,
  InvoiceReminderJobPayload,
  MediaJobPayload,
  NotificationJobPayload
} from './queue.payloads.js';
import type { QueuePort } from './queue.port.js';
import { NOTIFICATIONS_DEAD_LETTER_QUEUE } from './queues.tokens.js';

@Injectable()
export class QueueConsumerService {
  private readonly logger = new Logger(QueueConsumerService.name);

  constructor(
    private readonly notifications: NotificationDispatchService,
    @Inject(NOTIFICATIONS_DEAD_LETTER_QUEUE)
    private readonly notificationsDeadLetterQueue: QueuePort
  ) {}

  process(queueName: QueueName, job: Job): Promise<void> {
    switch (queueName) {
      case QUEUE_NAMES.notifications:
        return this.processNotification(job as Job<NotificationJobPayload>);
      case QUEUE_NAMES.notificationsDeadLetter:
        return this.processDeadLetterNotification(job as Job<DeadLetterNotificationJobPayload>);
      case QUEUE_NAMES.invoiceReminders:
        return this.processInvoiceReminder(job as Job<InvoiceReminderJobPayload>);
      case QUEUE_NAMES.mediaJobs:
        return this.processMediaJob(job as Job<MediaJobPayload>);
      default:
        return Promise.reject(new Error(`Unsupported queue: ${queueName as string}`));
    }
  }

  processNotification(job: Job<NotificationJobPayload>): Promise<void> {
    this.logger.log(`Processing notification job ${job.id ?? 'unknown'} (${job.data.template})`);

    return this.notifications.dispatch(job.data).catch(async (error: unknown) => {
      const attemptsLimit = job.opts.attempts ?? DEFAULT_JOB_OPTIONS.attempts ?? 1;
      const nextAttempt = (job.attemptsMade ?? 0) + 1;
      const isLastAttempt = nextAttempt >= attemptsLimit;
      const isTransient = error instanceof NotificationDispatchError && error.kind === 'transient';

      if (isTransient && !isLastAttempt) {
        throw error;
      }

      await this.notificationsDeadLetterQueue.add(
        'dead-letter-notification',
        {
          original: job.data,
          reason: error instanceof Error ? error.message : 'Unknown notification failure',
          attemptsMade: nextAttempt
        },
        {
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: 50
        }
      );
    });
  }

  processDeadLetterNotification(job: Job<DeadLetterNotificationJobPayload>): Promise<void> {
    this.logger.warn(
      `Notification moved to dead-letter queue (job=${job.id ?? 'unknown'}, reason=${job.data.reason})`
    );
    return Promise.resolve();
  }

  processInvoiceReminder(job: Job<InvoiceReminderJobPayload>): Promise<void> {
    this.logger.log(`Processing invoice reminder job ${job.id ?? 'unknown'}`);
    return Promise.resolve();
  }

  processMediaJob(job: Job<MediaJobPayload>): Promise<void> {
    this.logger.log(`Processing media job ${job.id ?? 'unknown'}`);
    return Promise.resolve();
  }
}
