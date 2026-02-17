export type PaymentWebhookEventType = 'payment.succeeded' | 'payment.failed' | 'payment.refunded';

export interface NormalizedPaymentWebhookEvent {
  provider: string;
  eventId: string;
  type: PaymentWebhookEventType;
  organizationId: string;
  invoiceId: string;
  providerRef: string;
  amountCents: number;
  currency: string;
  occurredAt: Date;
  rawPayload: Record<string, unknown>;
}

export interface PaymentProviderWebhookAdapter {
  readonly provider: string;
  verifySignature(signature: string | undefined, payload: string): boolean;
  parseEvent(payload: string): NormalizedPaymentWebhookEvent;
}
