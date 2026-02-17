import { Injectable } from '@nestjs/common';

import type { NotificationJobPayload } from './queue.payloads.js';
import { NotificationChannelService } from './notification-channel.service.js';
import { NotificationTemplateService } from './notification-template.service.js';

export class NotificationDispatchError extends Error {
  constructor(
    public readonly kind: 'transient' | 'permanent',
    message: string
  ) {
    super(message);
  }
}

@Injectable()
export class NotificationDispatchService {
  constructor(
    private readonly templates: NotificationTemplateService,
    private readonly channels: NotificationChannelService
  ) {}

  async dispatch(payload: NotificationJobPayload): Promise<void> {
    if (payload.simulateFailure === 'transient') {
      throw new NotificationDispatchError('transient', 'Simulated transient notification failure');
    }
    if (payload.simulateFailure === 'permanent') {
      throw new NotificationDispatchError('permanent', 'Simulated permanent notification failure');
    }

    let message;
    try {
      message = this.templates.render(payload);
    } catch (error) {
      throw new NotificationDispatchError(
        'permanent',
        error instanceof Error ? error.message : 'Template rendering failure'
      );
    }

    if (payload.channel === 'email') {
      await this.channels.sendEmail(payload.recipientUserId, message);
      return;
    }
    if (payload.channel === 'push') {
      await this.channels.sendPush(payload.recipientUserId, message);
      return;
    }

    throw new NotificationDispatchError('permanent', 'Unsupported notification channel');
  }
}
