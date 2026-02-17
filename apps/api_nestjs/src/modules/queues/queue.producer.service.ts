import { Inject, Injectable } from '@nestjs/common';

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
    @Inject(MEDIA_JOBS_QUEUE) private readonly mediaJobsQueue: QueuePort
  ) {}

  enqueueNotification(payload: NotificationJobPayload): Promise<void> {
    return this.notificationsQueue.add('notify-user', payload, DEFAULT_JOB_OPTIONS);
  }

  enqueueInvoiceReminder(payload: InvoiceReminderJobPayload): Promise<void> {
    return this.invoiceRemindersQueue.add('send-invoice-reminder', payload, DEFAULT_JOB_OPTIONS);
  }

  enqueueMediaJob(payload: MediaJobPayload): Promise<void> {
    return this.mediaJobsQueue.add('process-media', payload, DEFAULT_JOB_OPTIONS);
  }

  getQueueNames(): string[] {
    return [
      QUEUE_NAMES.notifications,
      QUEUE_NAMES.notificationsDeadLetter,
      QUEUE_NAMES.invoiceReminders,
      QUEUE_NAMES.mediaJobs
    ];
  }
}
