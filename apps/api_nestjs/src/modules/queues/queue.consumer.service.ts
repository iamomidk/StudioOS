import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { MetricsService } from '../../common/modules/metrics/metrics.service.js';
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
  private readonly processedDedupeKeys = new Set<string>();

  constructor(
    private readonly notifications: NotificationDispatchService,
    @Inject(NOTIFICATIONS_DEAD_LETTER_QUEUE)
    private readonly notificationsDeadLetterQueue: QueuePort,
    private readonly metrics: MetricsService
  ) {}

  async process(queueName: QueueName, job: Job): Promise<void> {
    try {
      switch (queueName) {
        case QUEUE_NAMES.notifications:
          await this.processNotification(job as Job<NotificationJobPayload>);
          break;
        case QUEUE_NAMES.notificationsDeadLetter:
          await this.processDeadLetterNotification(job as Job<DeadLetterNotificationJobPayload>);
          break;
        case QUEUE_NAMES.invoiceReminders:
          await this.processInvoiceReminder(job as Job<InvoiceReminderJobPayload>);
          break;
        case QUEUE_NAMES.mediaJobs:
          await this.processMediaJob(job as Job<MediaJobPayload>);
          break;
        default:
          throw new Error(`Unsupported queue: ${queueName as string}`);
      }

      this.metrics.recordQueueProcessed(queueName, true);
    } catch (error) {
      this.metrics.recordQueueProcessed(queueName, false);
      throw error;
    }
  }

  processNotification(job: Job<NotificationJobPayload>): Promise<void> {
    const dedupeKey = job.data.meta?.dedupeKey;
    if (dedupeKey && this.processedDedupeKeys.has(dedupeKey)) {
      this.logger.warn(`Skipping duplicate notification job for dedupe key ${dedupeKey}`);
      return Promise.resolve();
    }

    this.logger.log(
      `Processing notification job ${job.id ?? 'unknown'} (${job.data.template}) from ${
        job.data.meta?.regionOrigin ?? 'unknown-region'
      }`
    );

    return this.notifications
      .dispatch(job.data)
      .catch(async (error: unknown) => {
        const attemptsLimit = job.opts.attempts ?? DEFAULT_JOB_OPTIONS.attempts ?? 1;
        const nextAttempt = (job.attemptsMade ?? 0) + 1;
        const isLastAttempt = nextAttempt >= attemptsLimit;
        const isTransient =
          error instanceof NotificationDispatchError && error.kind === 'transient';

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
      })
      .then(() => {
        if (dedupeKey) {
          this.processedDedupeKeys.add(dedupeKey);
        }
      });
  }

  processDeadLetterNotification(job: Job<DeadLetterNotificationJobPayload>): Promise<void> {
    this.logger.warn(
      `Notification moved to dead-letter queue (job=${job.id ?? 'unknown'}, reason=${job.data.reason})`
    );
    return Promise.resolve();
  }

  processInvoiceReminder(job: Job<InvoiceReminderJobPayload>): Promise<void> {
    this.logger.log(
      `Processing invoice reminder job ${job.id ?? 'unknown'} from ${
        job.data.meta?.regionOrigin ?? 'unknown-region'
      }`
    );
    return Promise.resolve();
  }

  processMediaJob(job: Job<MediaJobPayload>): Promise<void> {
    this.logger.log(
      `Processing media job ${job.id ?? 'unknown'} from ${
        job.data.meta?.regionOrigin ?? 'unknown-region'
      }`
    );
    return Promise.resolve();
  }
}
