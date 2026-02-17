import { Inject, Injectable } from '@nestjs/common';

import { MetricsService } from '../../common/modules/metrics/metrics.service.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES } from './queue.constants.js';
import type {
  InvoiceReminderJobPayload,
  MediaJobPayload,
  NotificationJobPayload
} from './queue.payloads.js';
import type { QueuePort } from './queue.port.js';
import { INVOICE_REMINDERS_QUEUE, MEDIA_JOBS_QUEUE, NOTIFICATIONS_QUEUE } from './queues.tokens.js';

@Injectable()
export class QueueProducerService {
  constructor(
    @Inject(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: QueuePort,
    @Inject(INVOICE_REMINDERS_QUEUE) private readonly invoiceRemindersQueue: QueuePort,
    @Inject(MEDIA_JOBS_QUEUE) private readonly mediaJobsQueue: QueuePort,
    private readonly metrics: MetricsService,
    private readonly config: AppConfigService
  ) {}

  async enqueueNotification(payload: NotificationJobPayload): Promise<void> {
    const withRegion = this.withRegionMeta(payload, payload.meta?.dedupeKey);
    await this.notificationsQueue.add('notify-user', withRegion, {
      ...DEFAULT_JOB_OPTIONS,
      ...(withRegion.meta?.dedupeKey ? { jobId: `notify:${withRegion.meta.dedupeKey}` } : {})
    });
    this.metrics.recordQueueEnqueued(QUEUE_NAMES.notifications);
  }

  async enqueueInvoiceReminder(payload: InvoiceReminderJobPayload): Promise<void> {
    const dedupeKey = payload.meta?.dedupeKey ?? `${payload.invoiceId}:${payload.reminderType}`;
    const withRegion = this.withRegionMeta(payload, dedupeKey);
    await this.invoiceRemindersQueue.add('send-invoice-reminder', withRegion, {
      ...DEFAULT_JOB_OPTIONS,
      jobId: `invoice-reminder:${dedupeKey}`
    });
    this.metrics.recordQueueEnqueued(QUEUE_NAMES.invoiceReminders);
  }

  async enqueueMediaJob(payload: MediaJobPayload): Promise<void> {
    const dedupeKey =
      payload.meta?.dedupeKey ?? `${payload.assetId}:${payload.operation}:${payload.sourceUrl}`;
    const withRegion = this.withRegionMeta(payload, dedupeKey);
    await this.mediaJobsQueue.add('process-media', withRegion, {
      ...DEFAULT_JOB_OPTIONS,
      jobId: `media:${dedupeKey}`
    });
    this.metrics.recordQueueEnqueued(QUEUE_NAMES.mediaJobs);
  }

  getQueueNames(): string[] {
    return [
      QUEUE_NAMES.notifications,
      QUEUE_NAMES.notificationsDeadLetter,
      QUEUE_NAMES.invoiceReminders,
      QUEUE_NAMES.mediaJobs
    ];
  }

  private withRegionMeta<
    TPayload extends {
      meta?: {
        regionOrigin?: string;
        failoverMode?: 'off' | 'passive' | 'active';
        dedupeKey?: string;
      };
    }
  >(payload: TPayload, dedupeKey?: string): TPayload {
    return {
      ...payload,
      meta: {
        ...payload.meta,
        regionOrigin: this.config.regionId,
        failoverMode: this.config.failoverMode,
        ...(dedupeKey ? { dedupeKey } : {})
      }
    };
  }
}
