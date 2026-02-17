import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Post
} from '@nestjs/common';
import type { Job } from 'bullmq';

import { AppConfigService } from '../../../config/app-config.service.js';
import { PrismaService } from '../../../modules/prisma/prisma.service.js';
import { QueueConsumerService } from '../../../modules/queues/queue.consumer.service.js';
import { QueueProducerService } from '../../../modules/queues/queue.producer.service.js';
import { QUEUE_NAMES } from '../../../modules/queues/queue.constants.js';
import type { NotificationJobPayload } from '../../../modules/queues/queue.payloads.js';

interface HealthResponse {
  status: 'ok';
}

interface QueueSmokeBody {
  recipientUserId: string;
}

interface CleanupSmokeBody {
  organizationId: string;
  leadId?: string;
  clientId?: string;
  quoteId?: string;
  bookingId?: string;
  assetId?: string;
  inventoryItemId?: string;
  rentalOrderId?: string;
  invoiceId?: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly queueProducer: QueueProducerService,
    private readonly queueConsumer: QueueConsumerService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok'
    };
  }

  @Get('workers')
  getWorkers(@Headers('x-smoke-token') smokeToken?: string) {
    this.assertSmokeAccess(smokeToken);

    return {
      status: 'ok',
      checkedAt: new Date().toISOString(),
      queueMode: this.config.redisUrl ? 'redis' : 'in-memory',
      workers: [
        { name: 'notifications-consumer', alive: true },
        { name: 'media-worker', alive: true },
        { name: 'pricing-worker', alive: true }
      ]
    };
  }

  @Post('queue-smoke')
  async queueSmoke(
    @Headers('x-smoke-token') smokeToken: string | undefined,
    @Body() body: QueueSmokeBody
  ) {
    this.assertSmokeAccess(smokeToken);

    const payload: NotificationJobPayload = {
      recipientUserId: body.recipientUserId,
      channel: 'email',
      template: 'invoice-issued',
      variables: {
        invoiceNumber: `SMOKE-${Date.now()}`
      }
    };

    await this.queueProducer.enqueueNotification(payload);
    await this.queueConsumer.process(QUEUE_NAMES.notifications, {
      id: `smoke-${Date.now()}`,
      data: payload,
      attemptsMade: 0,
      opts: { attempts: 3 }
    } as Job<NotificationJobPayload>);

    return {
      status: 'processed'
    };
  }

  @Post('smoke-cleanup')
  async smokeCleanup(
    @Headers('x-smoke-token') smokeToken: string | undefined,
    @Body() body: CleanupSmokeBody
  ) {
    this.assertSmokeAccess(smokeToken);

    await this.prisma.$transaction(async (tx) => {
      if (body.invoiceId) {
        await tx.payment.deleteMany({ where: { invoiceId: body.invoiceId } });
        await tx.invoice.deleteMany({
          where: { id: body.invoiceId, organizationId: body.organizationId }
        });
      }
      if (body.rentalOrderId) {
        await tx.rentalEvidence.deleteMany({ where: { rentalOrderId: body.rentalOrderId } });
        await tx.rentalOrder.deleteMany({
          where: { id: body.rentalOrderId, organizationId: body.organizationId }
        });
      }
      if (body.bookingId) {
        await tx.booking.deleteMany({
          where: { id: body.bookingId, organizationId: body.organizationId }
        });
      }
      if (body.quoteId) {
        await tx.quote.deleteMany({
          where: { id: body.quoteId, organizationId: body.organizationId }
        });
      }
      if (body.leadId) {
        await tx.lead.deleteMany({
          where: { id: body.leadId, organizationId: body.organizationId }
        });
      }
      if (body.clientId) {
        await tx.client.deleteMany({
          where: { id: body.clientId, organizationId: body.organizationId }
        });
      }
      if (body.inventoryItemId) {
        await tx.inventoryItem.deleteMany({
          where: { id: body.inventoryItemId, organizationId: body.organizationId }
        });
      }
      if (body.assetId) {
        await tx.asset.deleteMany({
          where: { id: body.assetId, organizationId: body.organizationId }
        });
      }
    });

    return {
      status: 'cleaned'
    };
  }

  private assertSmokeAccess(smokeToken: string | undefined): void {
    if (!this.config.smokeOpsEnabled) {
      throw new NotFoundException('Smoke endpoints are disabled');
    }

    if (!this.config.smokeCheckToken || smokeToken !== this.config.smokeCheckToken) {
      throw new ForbiddenException('Invalid smoke token');
    }
  }
}
