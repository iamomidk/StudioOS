import { Injectable } from '@nestjs/common';

import type { NotificationJobPayload } from './queue.payloads.js';

export interface RenderedNotificationTemplate {
  subject: string;
  body: string;
}

@Injectable()
export class NotificationTemplateService {
  render(payload: NotificationJobPayload): RenderedNotificationTemplate {
    const vars = payload.variables ?? {};

    switch (payload.template) {
      case 'invoice-issued':
        return {
          subject: `Invoice ${vars.invoiceNumber ?? ''} issued`.trim(),
          body: `Your invoice ${vars.invoiceNumber ?? ''} is now issued.`
        };
      case 'invoice-paid':
        return {
          subject: `Invoice ${vars.invoiceNumber ?? ''} paid`.trim(),
          body: `Payment received for invoice ${vars.invoiceNumber ?? ''}.`
        };
      case 'rental-reserved':
        return {
          subject: `Rental reserved`,
          body: `Your rental reservation has been confirmed.`
        };
      default:
        throw new Error(`Unknown notification template: ${payload.template}`);
    }
  }
}
