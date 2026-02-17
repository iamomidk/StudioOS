export interface QueueRegionalMeta {
  regionOrigin: string;
  failoverMode: 'off' | 'passive' | 'active';
  dedupeKey?: string;
}

export interface NotificationJobPayload {
  recipientUserId: string;
  channel: 'email' | 'push';
  template: string;
  variables?: Record<string, string>;
  simulateFailure?: 'transient' | 'permanent';
  meta?: QueueRegionalMeta;
}

export interface InvoiceReminderJobPayload {
  invoiceId: string;
  organizationId: string;
  reminderType: 'upcoming_due' | 'overdue';
  meta?: QueueRegionalMeta;
}

export interface MediaJobPayload {
  assetId: string;
  sourceUrl: string;
  operation: 'metadata' | 'thumbnail' | 'proxy';
  meta?: QueueRegionalMeta;
}

export interface DeadLetterNotificationJobPayload {
  original: NotificationJobPayload;
  reason: string;
  attemptsMade: number;
}
