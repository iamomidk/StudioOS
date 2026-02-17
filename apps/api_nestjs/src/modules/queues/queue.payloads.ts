export interface NotificationJobPayload {
  recipientUserId: string;
  channel: 'email' | 'push';
  template: string;
  variables?: Record<string, string>;
  simulateFailure?: 'transient' | 'permanent';
}

export interface InvoiceReminderJobPayload {
  invoiceId: string;
  organizationId: string;
  reminderType: 'upcoming_due' | 'overdue';
}

export interface MediaJobPayload {
  assetId: string;
  sourceUrl: string;
  operation: 'metadata' | 'thumbnail' | 'proxy';
}

export interface DeadLetterNotificationJobPayload {
  original: NotificationJobPayload;
  reason: string;
  attemptsMade: number;
}
