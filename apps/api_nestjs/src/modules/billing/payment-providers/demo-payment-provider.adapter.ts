import { createHmac, timingSafeEqual } from 'node:crypto';

import { BadRequestException } from '@nestjs/common';

import { AppConfigService } from '../../../config/app-config.service.js';
import {
  type NormalizedPaymentWebhookEvent,
  type PaymentProviderWebhookAdapter
} from './payment-provider.adapter.js';

type DemoWebhookEventType = 'payment.succeeded' | 'payment.failed' | 'payment.refunded';

interface DemoWebhookPayload {
  eventId: string;
  type: DemoWebhookEventType;
  organizationId: string;
  invoiceId: string;
  providerRef: string;
  amountCents: number;
  currency: string;
  occurredAt: string;
}

export class DemoPaymentProviderAdapter implements PaymentProviderWebhookAdapter {
  readonly provider = 'demo';

  constructor(private readonly config: AppConfigService) {}

  verifySignature(signature: string | undefined, payload: string): boolean {
    if (!signature) {
      return false;
    }

    const expected = createHmac('sha256', this.config.paymentWebhookDemoSecret)
      .update(payload)
      .digest('hex');

    const normalizedSignature = signature.trim();
    if (normalizedSignature.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(normalizedSignature), Buffer.from(expected));
  }

  parseEvent(payload: string): NormalizedPaymentWebhookEvent {
    let parsed: DemoWebhookPayload;
    try {
      parsed = JSON.parse(payload) as DemoWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    if (
      !parsed.eventId ||
      !parsed.type ||
      !parsed.organizationId ||
      !parsed.invoiceId ||
      !parsed.providerRef ||
      !Number.isInteger(parsed.amountCents) ||
      parsed.amountCents < 0 ||
      !parsed.currency
    ) {
      throw new BadRequestException('Invalid webhook payload');
    }

    const occurredAt = new Date(parsed.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Invalid webhook payload');
    }

    return {
      provider: this.provider,
      eventId: parsed.eventId,
      type: parsed.type,
      organizationId: parsed.organizationId,
      invoiceId: parsed.invoiceId,
      providerRef: parsed.providerRef,
      amountCents: parsed.amountCents,
      currency: parsed.currency,
      occurredAt,
      rawPayload: parsed as unknown as Record<string, unknown>
    };
  }
}
