import { Body, Controller, Headers, Param, Post } from '@nestjs/common';

import { PaymentWebhookService } from './payment-webhook.service.js';

@Controller('billing/payments')
export class PaymentWebhookController {
  constructor(private readonly webhookService: PaymentWebhookService) {}

  @Post('webhook/:provider')
  handleWebhook(
    @Param('provider') provider: string,
    @Headers('x-provider-signature') signature: string | undefined,
    @Body() payload: Record<string, unknown>
  ) {
    return this.webhookService.handleWebhook(provider, signature, JSON.stringify(payload));
  }
}
