import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { Prisma, type PaymentStatus } from '@prisma/client';

import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DemoPaymentProviderAdapter } from './payment-providers/demo-payment-provider.adapter.js';
import type {
  NormalizedPaymentWebhookEvent,
  PaymentProviderWebhookAdapter
} from './payment-providers/payment-provider.adapter.js';

@Injectable()
export class PaymentWebhookService {
  private readonly adapters: Map<string, PaymentProviderWebhookAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    config: AppConfigService
  ) {
    const demoAdapter = new DemoPaymentProviderAdapter(config);
    this.adapters = new Map([[demoAdapter.provider, demoAdapter]]);
  }

  async handleWebhook(provider: string, signature: string | undefined, payload: string) {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }

    if (!adapter.verifySignature(signature, payload)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = adapter.parseEvent(payload);

    return this.prisma.$transaction(async (tx) => {
      const existingEvent = await tx.paymentWebhookEvent.findUnique({
        where: {
          provider_eventId: {
            provider: event.provider,
            eventId: event.eventId
          }
        }
      });

      if (existingEvent) {
        return {
          status: 'duplicate',
          eventId: existingEvent.eventId,
          paymentId: existingEvent.paymentId
        } as const;
      }

      const invoice = await tx.invoice.findFirst({
        where: {
          id: event.invoiceId,
          organizationId: event.organizationId
        }
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      const paymentStatus = this.mapEventToPaymentStatus(event.type);
      const existingPayment = await tx.payment.findFirst({
        where: {
          organizationId: event.organizationId,
          invoiceId: event.invoiceId,
          provider: event.provider,
          providerRef: event.providerRef
        }
      });

      const payment = existingPayment
        ? await tx.payment.update({
            where: { id: existingPayment.id },
            data: {
              amountCents: event.amountCents,
              currency: event.currency,
              status: paymentStatus,
              paidAt: paymentStatus === 'succeeded' ? event.occurredAt : null
            }
          })
        : await tx.payment.create({
            data: {
              organizationId: event.organizationId,
              invoiceId: event.invoiceId,
              provider: event.provider,
              providerRef: event.providerRef,
              amountCents: event.amountCents,
              currency: event.currency,
              status: paymentStatus,
              paidAt: paymentStatus === 'succeeded' ? event.occurredAt : null
            }
          });

      const nextInvoiceStatus = await this.computeInvoiceStatusFromPayments(
        tx,
        event.invoiceId,
        invoice.totalCents
      );
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: nextInvoiceStatus }
      });

      await tx.paymentWebhookEvent.create({
        data: {
          provider: event.provider,
          eventId: event.eventId,
          organizationId: event.organizationId,
          invoiceId: event.invoiceId,
          paymentId: payment.id,
          payload: event.rawPayload as Prisma.InputJsonValue
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: event.organizationId,
          entityType: 'Payment',
          entityId: payment.id,
          action: 'payment.webhook.applied',
          metadata: {
            provider: event.provider,
            eventId: event.eventId,
            eventType: event.type,
            invoiceStatus: nextInvoiceStatus
          }
        }
      });

      return {
        status: 'processed',
        eventId: event.eventId,
        paymentId: payment.id
      } as const;
    });
  }

  private mapEventToPaymentStatus(type: NormalizedPaymentWebhookEvent['type']): PaymentStatus {
    if (type === 'payment.succeeded') {
      return 'succeeded';
    }
    if (type === 'payment.failed') {
      return 'failed';
    }
    return 'refunded';
  }

  private async computeInvoiceStatusFromPayments(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    invoiceTotalCents: number
  ): Promise<'issued' | 'partially_paid' | 'paid'> {
    const succeeded = await tx.payment.aggregate({
      where: {
        invoiceId,
        status: 'succeeded'
      },
      _sum: {
        amountCents: true
      }
    });

    const paidAmount = succeeded._sum.amountCents ?? 0;
    if (paidAmount >= invoiceTotalCents) {
      return 'paid';
    }
    if (paidAmount > 0) {
      return 'partially_paid';
    }
    return 'issued';
  }
}
