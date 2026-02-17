import { Module } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';

import { AppConfigService } from '../../config/app-config.service.js';
import { ConfigModule } from '../../config/config.module.js';
import { BullMqQueueAdapter } from './bullmq-queue.adapter.js';
import { InMemoryQueueAdapter } from './in-memory-queue.adapter.js';
import { QUEUE_NAMES } from './queue.constants.js';
import { QueueConsumerService } from './queue.consumer.service.js';
import { QueueProducerService } from './queue.producer.service.js';
import { NotificationChannelService } from './notification-channel.service.js';
import { NotificationDispatchService } from './notification-dispatch.service.js';
import { NotificationTemplateService } from './notification-template.service.js';
import {
  INVOICE_REMINDERS_QUEUE,
  MEDIA_JOBS_QUEUE,
  NOTIFICATIONS_DEAD_LETTER_QUEUE,
  NOTIFICATIONS_QUEUE
} from './queues.tokens.js';

function redisConnectionFromUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const dbFromPath = url.pathname.replace('/', '');

  const connection: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
    tls?: object;
  } = {
    host: url.hostname,
    port: Number(url.port || 6379)
  };

  if (url.username) {
    connection.username = url.username;
  }
  if (url.password) {
    connection.password = url.password;
  }
  if (dbFromPath) {
    connection.db = Number(dbFromPath);
  }
  if (url.protocol === 'rediss:') {
    connection.tls = {};
  }

  return connection;
}

function createQueueAdapter(
  config: AppConfigService,
  queueName: string
): BullMqQueueAdapter | InMemoryQueueAdapter {
  if (config.nodeEnv === 'test') {
    return new InMemoryQueueAdapter();
  }

  const queue = new Queue(queueName, {
    connection: redisConnectionFromUrl(config.redisUrl)
  });
  return new BullMqQueueAdapter(queue);
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: NOTIFICATIONS_QUEUE,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        createQueueAdapter(config, QUEUE_NAMES.notifications)
    },
    {
      provide: INVOICE_REMINDERS_QUEUE,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        createQueueAdapter(config, QUEUE_NAMES.invoiceReminders)
    },
    {
      provide: NOTIFICATIONS_DEAD_LETTER_QUEUE,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        createQueueAdapter(config, QUEUE_NAMES.notificationsDeadLetter)
    },
    {
      provide: MEDIA_JOBS_QUEUE,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => createQueueAdapter(config, QUEUE_NAMES.mediaJobs)
    },
    NotificationTemplateService,
    NotificationChannelService,
    NotificationDispatchService,
    QueueProducerService,
    QueueConsumerService
  ],
  exports: [QueueProducerService, QueueConsumerService]
})
export class QueuesModule {}
